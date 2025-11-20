import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, PlayRecord as ApiPlayRecord, Favorite as ApiFavorite } from "./api";
import { storageConfig } from "./storageConfig";
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

// --- Types ---
export type PlayRecord = ApiPlayRecord & {
  description?: string;
  introEndTime?: number;
  outroStartTime?: number;
};
export type Favorite = ApiFavorite;

export interface PlayerSettings {
  introEndTime?: number;
  outroStartTime?: number;
  playbackRate?: number;
}

export interface AppSettings {
  apiBaseUrl: string;
  remoteInputEnabled: boolean;
  videoSource: {
    enabledAll: boolean;
    sources: {
      [key: string]: boolean;
    };
  };
  m3uUrl: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

const generateKey = (source: string, id: string) => `${source}+${id}`;

// --- Base Cache Class ---
class MemoryCache<T> {
  private cache: T | null = null;
  private key: string;
  private lastFetch: number = 0;
  private ttl: number; // Time to live in ms

  constructor(key: string, ttl: number = 5000) { // Default 5s cache for safety against rapid reads
    this.key = key;
    this.ttl = ttl;
  }

  async get(fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (this.cache && (now - this.lastFetch < this.ttl)) {
      return this.cache;
    }
    const data = await fetcher();
    this.cache = data;
    this.lastFetch = Date.now();
    return data;
  }

  set(data: T) {
    this.cache = data;
    this.lastFetch = Date.now();
  }

  invalidate() {
    this.cache = null;
  }
}

// --- Caches ---
// We use a longer TTL for settings and records as they don't change externally often.
// Write operations will manually update the cache.
const playerSettingsCache = new MemoryCache<Record<string, PlayerSettings>>(STORAGE_KEYS.PLAYER_SETTINGS, 60000);

// --- PlayerSettingsManager ---
export class PlayerSettingsManager {
  static async getAll(): Promise<Record<string, PlayerSettings>> {
    return playerSettingsCache.get(async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYER_SETTINGS);
        return data ? JSON.parse(data) : {};
      } catch (error) {
        logger.info("Failed to get all player settings:", error);
        return {};
      }
    });
  }

  static async get(source: string, id: string): Promise<PlayerSettings | null> {
    const allSettings = await this.getAll();
    return allSettings[generateKey(source, id)] || null;
  }

  static async save(source: string, id: string, settings: PlayerSettings): Promise<void> {
    const allSettings = await this.getAll(); // Ensure cache is warm
    const key = generateKey(source, id);

    if (settings.introEndTime !== undefined || settings.outroStartTime !== undefined || settings.playbackRate !== undefined) {
      allSettings[key] = { ...allSettings[key], ...settings };
    } else {
      delete allSettings[key];
    }

    // Update cache immediately
    playerSettingsCache.set(allSettings);
    // Persist asynchronously
    AsyncStorage.setItem(STORAGE_KEYS.PLAYER_SETTINGS, JSON.stringify(allSettings)).catch(e => logger.error("Failed to persist player settings", e));
  }

  static async remove(source: string, id: string): Promise<void> {
    const allSettings = await this.getAll();
    delete allSettings[generateKey(source, id)];
    playerSettingsCache.set(allSettings);
    AsyncStorage.setItem(STORAGE_KEYS.PLAYER_SETTINGS, JSON.stringify(allSettings)).catch(e => logger.error("Failed to persist player settings removal", e));
  }

  static async clearAll(): Promise<void> {
    playerSettingsCache.set({});
    await AsyncStorage.removeItem(STORAGE_KEYS.PLAYER_SETTINGS);
  }
}

// --- FavoriteManager ---
export class FavoriteManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  static async getAll(): Promise<Record<string, Favorite>> {
    // Note: Not caching Favorites heavily yet as they might be edited elsewhere if using API
    if (this.getStorageType() === "localstorage") {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
        return data ? JSON.parse(data) : {};
      } catch (error) {
        logger.info("Failed to get all local favorites:", error);
        return {};
      }
    }
    return (await api.getFavorites()) as Record<string, Favorite>;
  }

  static async save(source: string, id: string, item: Favorite): Promise<void> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      const allFavorites = await this.getAll();
      allFavorites[key] = { ...item, save_time: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(allFavorites));
      return;
    }
    await api.addFavorite(key, item);
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      const allFavorites = await this.getAll();
      delete allFavorites[key];
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(allFavorites));
      return;
    }
    await api.deleteFavorite(key);
  }

  static async isFavorited(source: string, id: string): Promise<boolean> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      const allFavorites = await this.getAll();
      return !!allFavorites[key];
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
      await AsyncStorage.removeItem(STORAGE_KEYS.FAVORITES);
      return;
    }
    await api.deleteFavorite();
  }
}

// --- PlayRecordManager Cache ---
// Caching API records is tricky if they change on server, but for play records usually local is freshest.
// We'll cache local storage read.
const localPlayRecordsCache = new MemoryCache<Record<string, PlayRecord>>(STORAGE_KEYS.PLAY_RECORDS, 30000);

export class PlayRecordManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  static async getAll(): Promise<Record<string, PlayRecord>> {
    const storageType = this.getStorageType();
    
    let apiRecords: Record<string, PlayRecord> = {};
    if (storageType === "localstorage") {
      apiRecords = await localPlayRecordsCache.get(async () => {
        try {
          const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAY_RECORDS);
          return data ? JSON.parse(data) : {};
        } catch (error) {
          logger.info("Failed to get all local play records:", error);
          return {};
        }
      });
    } else {
      // For API, we probably shouldn't cache indefinitely, but maybe for a short session
      apiRecords = await api.getPlayRecords();
    }

    // Merge with settings (which is cached now)
    const localSettings = await PlayerSettingsManager.getAll();

    // Merging is fast enough in memory usually, unless thousands of records
    const mergedRecords: Record<string, PlayRecord> = {};
    for (const key in apiRecords) {
      mergedRecords[key] = {
        ...apiRecords[key],
        ...localSettings[key],
      };
    }
    
    return mergedRecords;
  }

  static async getAllLatestByTitle(): Promise<Record<string, PlayRecord>> {
    const allRecords = await this.getAll();
    const sortedRecords = Object.entries(allRecords).sort(([, a], [, b]) => (b.save_time ?? 0) - (a.save_time ?? 0));

    const latestByTitle: Record<string, PlayRecord> = {};
    const seenTitles = new Set<string>();
    const limit = 25;

    for (const [key, record] of sortedRecords) {
        if (Object.keys(latestByTitle).length >= limit) break;
        const normTitle = (record?.title ?? '').trim().replace(/\s+/g, ' ');
        if (!normTitle) {
            latestByTitle[key] = record;
            continue;
        }
        if (!seenTitles.has(normTitle)) {
            latestByTitle[key] = record;
            seenTitles.add(normTitle);
        }
    }
    return latestByTitle;
  }

  static async save(source: string, id: string, record: Omit<PlayRecord, "save_time">): Promise<void> {
    const key = generateKey(source, id);
    const { introEndTime, outroStartTime, description, ...apiRecord } = record;

    await PlayerSettingsManager.save(source, id, { introEndTime, outroStartTime });

    if (this.getStorageType() === "localstorage") {
      // Get from cache first to avoid reading disk
      const allRecords = await localPlayRecordsCache.get(async () => {
         const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAY_RECORDS);
         return data ? JSON.parse(data) : {};
      });
      
      const existingRecord = allRecords[key] || {};
      const fullRecord = { ...apiRecord, save_time: Date.now() };
      const newRecord = { ...existingRecord, ...fullRecord };

      if (description && !existingRecord.description) {
        newRecord.description = description;
      }
      allRecords[key] = newRecord;

      // Update cache and persist
      localPlayRecordsCache.set(allRecords);
      AsyncStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(allRecords)).catch(e => logger.error("Failed to save play record", e));
    } else {
      const recordToSave = { ...apiRecord } as Omit<ApiPlayRecord, "save_time"> & { description?: string };
      const existingRecord = await this.get(source, id);
      if (description && !existingRecord?.description) {
        recordToSave.description = description;
      }
      await api.savePlayRecord(key, recordToSave);
    }
  }

  static async get(source: string, id: string): Promise<PlayRecord | null> {
    const key = generateKey(source, id);
    const records = await this.getAll();
    return records[key] || null;
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    await PlayerSettingsManager.remove(source, id);

    if (this.getStorageType() === "localstorage") {
      const allRecords = await localPlayRecordsCache.get(async () => ({})); // Should satisfy type, or fetch if empty
      delete allRecords[key];
      localPlayRecordsCache.set(allRecords);
      await AsyncStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(allRecords));
    } else {
      await api.deletePlayRecord(key);
    }
  }

  static async clearAll(): Promise<void> {
    await PlayerSettingsManager.clearAll();

    if (this.getStorageType() === "localstorage") {
      localPlayRecordsCache.set({});
      await AsyncStorage.removeItem(STORAGE_KEYS.PLAY_RECORDS);
    } else {
      await api.deletePlayRecord();
    }
  }
}

// --- SearchHistoryManager ---
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
        logger.info("Failed to get local search history:", error);
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
      history = [trimmed, ...history.filter((k) => k !== trimmed)].slice(0, 20);
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

// --- SettingsManager ---
export class SettingsManager {
  static async get(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      apiBaseUrl: "",
      remoteInputEnabled: true,
      videoSource: {
        enabledAll: true,
        sources: {},
      },
      m3uUrl: "",
    };
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch (error) {
      logger.info("Failed to get settings:", error);
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

// --- LoginCredentialsManager ---
export class LoginCredentialsManager {
  static async get(): Promise<LoginCredentials | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LOGIN_CREDENTIALS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.info("Failed to get login credentials:", error);
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
