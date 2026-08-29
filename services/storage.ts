import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PlayRecord,
  Favorite,
  PlayerSettings,
  AppSettings,
  LoginCredentials,
} from "@/types";
import { api } from "./api";
import { storageConfig } from "./storageConfig";
import { AsyncStorageDriver } from "./storage/AsyncStorageDriver";
import { DEFAULT_API_BASE_URL } from "@/constants/AppConfig";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('Storage');

// --- Storage Keys ---
const STORAGE_KEYS = {
  SETTINGS: "mytv_settings",
  PLAYER_SETTINGS: "mytv_player_settings",
  FAVORITES: "mytv_favorites",
  PLAY_RECORDS: "mytv_play_records",
  SEARCH_HISTORY: "mytv_search_history",
  LOGIN_CREDENTIALS: "mytv_login_credentials",
} as const;

export type { PlayRecord, Favorite, PlayerSettings, AppSettings, LoginCredentials };

// --- Helper ---
const generateKey = (source: string, id: string) => `${source}+${id}`;

// --- PlayerSettingsManager (Uses AsyncStorage) ---
export class PlayerSettingsManager {
  private static localDriver = new AsyncStorageDriver<PlayerSettings>(STORAGE_KEYS.PLAYER_SETTINGS);

  static async getAll(): Promise<Record<string, PlayerSettings>> {
    return this.localDriver.getAll();
  }

  static async get(source: string, id: string): Promise<PlayerSettings | null> {
    return this.localDriver.get(generateKey(source, id));
  }

  static async save(source: string, id: string, settings: PlayerSettings): Promise<void> {
    const allSettings = await this.getAll();
    const key = generateKey(source, id);
    // Only save if there are actual values to save
    if (settings.introEndTime !== undefined || settings.outroStartTime !== undefined || settings.playbackRate !== undefined) {
      allSettings[key] = { ...allSettings[key], ...settings };
      await this.localDriver.save(key, allSettings[key]);
    } else {
      // If all are undefined, remove the key
      await this.localDriver.remove(key);
    }
  }

  static async remove(source: string, id: string): Promise<void> {
    await this.localDriver.remove(generateKey(source, id));
  }

  static async clearAll(): Promise<void> {
    await this.localDriver.clearAll();
  }
}

// --- FavoriteManager (Dynamic: API or LocalStorage) ---
export class FavoriteManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  private static localDriver = new AsyncStorageDriver<Favorite>(STORAGE_KEYS.FAVORITES);

  static async getAll(): Promise<Record<string, Favorite>> {
    if (this.getStorageType() === "localstorage") {
      return this.localDriver.getAll();
    }
    return (await api.getFavorites()) as Record<string, Favorite>;
  }

  static async save(source: string, id: string, item: Favorite): Promise<void> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      return this.localDriver.save(key, { ...item, save_time: Date.now() });
    }
    await api.addFavorite(key, item);
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      return this.localDriver.remove(key);
    }
    await api.deleteFavorite(key);
  }

  static async isFavorited(source: string, id: string): Promise<boolean> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      const item = await this.localDriver.get(key);
      return item !== null;
    }
    const favorite = await api.getFavorites(key);
    return favorite !== null;
  }

  static async toggle(source: string, id: string, item: Favorite): Promise<boolean> {
    const isFav = await this.isFavorited(source, id);
    if (isFav) {
      await this.remove(source, id);
      return false;
    } else {
      await this.save(source, id, item);
      return true;
    }
  }

  static async clearAll(): Promise<void> {
    if (this.getStorageType() === "localstorage") {
      return this.localDriver.clearAll();
    }
    await api.deleteFavorite();
  }
}

// --- PlayRecordManager (Dynamic: API or LocalStorage) ---
export class PlayRecordManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  private static localDriver = new AsyncStorageDriver<PlayRecord>(STORAGE_KEYS.PLAY_RECORDS);
  private static cache: Record<string, PlayRecord> | null = null;
  private static cacheTimestamp: number = 0;
  private static CACHE_TTL = 60000; // 1 minute auto-expire just in case

  static async getAll(): Promise<Record<string, PlayRecord>> {
    if (this.cache && (Date.now() - this.cacheTimestamp < this.CACHE_TTL)) {
      return this.cache;
    }

    const perfStart = performance.now();
    const storageType = this.getStorageType();
    // logger.debug(`[PERF] PlayRecordManager.getAll START - storageType: ${storageType}`);

    let apiRecords: Record<string, PlayRecord> = {};
    if (storageType === "localstorage") {
      apiRecords = await this.localDriver.getAll();
    } else {
      const apiStart = performance.now();
      // logger.debug(`[PERF] API getPlayRecords START`);

      const result = await api.getPlayRecords();
      // When called without args, it returns the full map.
      // We default to {} if null/undefined to satisfy the type.
      apiRecords = (result as Record<string, PlayRecord>) || {};

      const apiEnd = performance.now();
      // logger.debug(`[PERF] API getPlayRecords END - took ${(apiEnd - apiStart).toFixed(2)}ms, records: ${Object.keys(apiRecords).length}`);
    }

    const localSettings = await PlayerSettingsManager.getAll();
    const mergedRecords: Record<string, PlayRecord> = {};
    for (const key in apiRecords) {
      mergedRecords[key] = {
        ...apiRecords[key],
        ...localSettings[key],
      };
    }

    const perfEnd = performance.now();
    // logger.debug(`[PERF] PlayRecordManager.getAll END - took ${(perfEnd - perfStart).toFixed(2)}ms, total records: ${Object.keys(mergedRecords).length}`);

    this.cache = mergedRecords;
    this.cacheTimestamp = Date.now();
    return mergedRecords;
  }

  static async getAllLatestByTitle(): Promise<Record<string, PlayRecord>> {
    const allRecords = await this.getAll();

    // 1. Sort all records by save_time descending
    const sortedRecords = Object.entries(allRecords).sort(([, a], [, b]) => (b.save_time ?? 0) - (a.save_time ?? 0));

    const latestByTitle: Record<string, PlayRecord> = {};
    const seenTitles = new Set<string>();
    const limit = 25;

    for (const [key, record] of sortedRecords) {
      // 2. Stop if we have collected enough unique titles
      if (Object.keys(latestByTitle).length >= limit) {
        break;
      }

      const normTitle = (record?.title ?? '').trim().replace(/\s+/g, ' ');
      // Composite key for strict deduplication: Title + Year + Type
      const uniqueKey = `${normTitle}|${record.year || ''}|${record.type || 'unknown'}`;

      // 3. If title is empty, treat it as unique and add it
      if (!normTitle) {
        latestByTitle[key] = record;
        continue;
      }

      // 4. If we haven't seen this content uniqueKey yet, add it
      if (!seenTitles.has(uniqueKey)) {
        latestByTitle[key] = record;
        seenTitles.add(uniqueKey);
      }
    }

    return latestByTitle;
  }

  static async getLatestByTitle(title: string, year?: string, type?: string): Promise<PlayRecord | null> {
    const allRecords = await this.getAll();
    const records = Object.values(allRecords);

    // Find records with matching title
    let matches = records.filter(r => r.title === title);

    // Filter by year if provided and record has year
    if (year) {
      const yearMatches = matches.filter(r => r.year === year);
      if (yearMatches.length > 0) matches = yearMatches;
    }

    // Filter by type if provided and record has type
    if (type) {
      const typeMatches = matches.filter(r => r.type === type);
      // Only apply if matches found (progressive filtering)
      if (typeMatches.length > 0) matches = typeMatches;
    }

    return matches.sort((a, b) => (b.save_time ?? 0) - (a.save_time ?? 0))[0] || null;
  }

  static async save(source: string, id: string, record: Omit<PlayRecord, "save_time">): Promise<void> {
    const key = generateKey(source, id);
    const { introEndTime, outroStartTime, description, ...apiRecord } = record;

    // Invalidate cache
    this.cache = null;

    // Player settings are always saved locally
    await PlayerSettingsManager.save(source, id, { introEndTime, outroStartTime });

    if (this.getStorageType() === "localstorage") {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAY_RECORDS);
      const allRecords = data ? JSON.parse(data) : {};
      const existingRecord = allRecords[key] || {};

      const fullRecord = { ...apiRecord, save_time: Date.now() };
      const newRecord = { ...existingRecord, ...fullRecord };

      // Only add description if it's provided and doesn't already exist
      if (description && !existingRecord.description) {
        newRecord.description = description;
      }
      allRecords[key] = newRecord;

      // --- LRU Purge ---
      const recordKeys = Object.keys(allRecords);
      const MAX_RECORDS = 200;
      if (recordKeys.length > MAX_RECORDS) {
        const sorted = recordKeys.sort((a, b) => (allRecords[a].save_time || 0) - (allRecords[b].save_time || 0));
        const toDelete = sorted.slice(0, recordKeys.length - MAX_RECORDS);
        toDelete.forEach(k => delete allRecords[k]);
        logger.info(`[Storage] Purged ${toDelete.length} old play records.`);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(allRecords));
    } else {
      const recordToSave = { ...apiRecord } as Omit<PlayRecord, "save_time"> & { description?: string };
      const existingRecord = await this.get(source, id);
      // Preserve existing description if available, otherwise use the new one.
      // This matches the local storage behavior and prevents overwriting with empty/undefined.
      if (existingRecord?.description) {
        recordToSave.description = existingRecord.description;
      } else if (description) {
        recordToSave.description = description;
      }
      await api.savePlayRecord(key, recordToSave);
    }
  }

  static async get(source: string, id: string): Promise<PlayRecord | null> {
    const perfStart = performance.now();
    const key = generateKey(source, id);
    const storageType = this.getStorageType();
    // logger.debug(`[PERF] PlayRecordManager.get START - source: ${source}, id: ${id}, storageType: ${storageType}`);

    let result: PlayRecord | null = null;
    if (storageType === "localstorage") {
      const records = await this.getAll();
      result = records[key] || null;
    } else {
      // For remote API, we can fetch just the single record
      const apiResult = await api.getPlayRecords(key);
      if (apiResult && !('title' in apiResult)) {
        // If it returns a Record<string, PlayRecord> (should be rare with key, but handling just in case)
        result = (apiResult as Record<string, PlayRecord>)[key] || null;
      } else {
        result = apiResult as PlayRecord | null;
      }

      if (result) {
        // Merge with local settings
        const localSettings = await PlayerSettingsManager.get(source, id);
        if (localSettings) {
          result = { ...result, ...localSettings };
        }
      }
    }

    const perfEnd = performance.now();
    // logger.debug(`[PERF] PlayRecordManager.get END - took ${(perfEnd - perfStart).toFixed(2)}ms, found: ${!!result}`);

    return result;
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    this.cache = null;

    await PlayerSettingsManager.remove(source, id); // Always remove local settings

    if (this.getStorageType() === "localstorage") {
      await this.localDriver.remove(key);
    } else {
      await api.deletePlayRecord(key);
    }
  }

  static async clearAll(): Promise<void> {
    this.cache = null;

    await PlayerSettingsManager.clearAll(); // Always clear local settings

    if (this.getStorageType() === "localstorage") {
      await this.localDriver.clearAll();
    } else {
      await api.deletePlayRecord();
    }
  }
}

// --- SearchHistoryManager (Dynamic: API or LocalStorage) ---
export class SearchHistoryManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  static async get(): Promise<string[]> {
    if (this.getStorageType() === "localstorage") {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
        return data ? JSON.parse(data) : [];
      } catch (error) {
        logger.debug("Failed to get local search history:", error);
        return [];
      }
    }
    return api.getSearchHistory();
  }

  static async add(keyword: string): Promise<void> {
    const trimmed = keyword.trim();
    if (!trimmed) return;

    if (this.getStorageType() === "localstorage") {
      let history = await this.get();
      history = [trimmed, ...history.filter((k) => k !== trimmed)].slice(0, 20); // Keep latest 20
      await AsyncStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
      return;
    }
    await api.addSearchHistory(trimmed);
  }

  static async clear(): Promise<void> {
    if (this.getStorageType() === "localstorage") {
      await AsyncStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
      return;
    }
    await api.deleteSearchHistory();
  }
}

// --- SettingsManager (Uses AsyncStorage) ---
export class SettingsManager {
  static async get(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      apiBaseUrl: DEFAULT_API_BASE_URL,
      remoteInputEnabled: true,
      videoSource: {
        enabledAll: true,
        sources: {},
      },
      m3uUrl: "",
    };
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return defaultSettings;
      const parsed = JSON.parse(data);
      return {
        ...defaultSettings,
        ...parsed,
        apiBaseUrl: parsed.apiBaseUrl || DEFAULT_API_BASE_URL,
      };
    } catch (error) {
      logger.debug("Failed to get settings:", error);
      return defaultSettings;
    }
  }

  static async save(settings: Partial<AppSettings>): Promise<void> {
    const currentSettings = await this.get();
    const updatedSettings = { ...currentSettings, ...settings };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
  }

  static async reset(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS);
  }
}

// --- LoginCredentialsManager (Uses AsyncStorage) ---
export class LoginCredentialsManager {
  static async get(): Promise<LoginCredentials | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LOGIN_CREDENTIALS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.debug("Failed to get login credentials:", error);
      return null;
    }
  }

  static async save(credentials: LoginCredentials): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LOGIN_CREDENTIALS, JSON.stringify(credentials));
    } catch (error) {
      logger.error("Failed to save login credentials:", error);
    }
  }

  static async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.LOGIN_CREDENTIALS);
    } catch (error) {
      logger.error("Failed to clear login credentials:", error);
    }
  }
}
