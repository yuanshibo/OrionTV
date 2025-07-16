import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, PlayRecord as ApiPlayRecord, Favorite as ApiFavorite } from "./api";
import { storageConfig } from "./storageConfig";

// --- Storage Keys ---
const STORAGE_KEYS = {
  SETTINGS: "mytv_settings",
  PLAYER_SETTINGS: "mytv_player_settings",
  FAVORITES: "mytv_favorites",
  PLAY_RECORDS: "mytv_play_records",
  SEARCH_HISTORY: "mytv_search_history",
} as const;

// --- Type Definitions (aligned with api.ts) ---
// Re-exporting for consistency, though they are now primarily API types
export type PlayRecord = ApiPlayRecord & {
  introEndTime?: number;
  outroStartTime?: number;
};
export type Favorite = ApiFavorite;

export interface PlayerSettings {
  introEndTime?: number;
  outroStartTime?: number;
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

// --- Helper ---
const generateKey = (source: string, id: string) => `${source}+${id}`;

// --- PlayerSettingsManager (Uses AsyncStorage) ---
export class PlayerSettingsManager {
  static async getAll(): Promise<Record<string, PlayerSettings>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYER_SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.info("Failed to get all player settings:", error);
      return {};
    }
  }

  static async get(source: string, id: string): Promise<PlayerSettings | null> {
    const allSettings = await this.getAll();
    return allSettings[generateKey(source, id)] || null;
  }

  static async save(source: string, id: string, settings: PlayerSettings): Promise<void> {
    const allSettings = await this.getAll();
    const key = generateKey(source, id);
    // Only save if there are actual values to save
    if (settings.introEndTime !== undefined || settings.outroStartTime !== undefined) {
      allSettings[key] = { ...allSettings[key], ...settings };
    } else {
      // If both are undefined, remove the key
      delete allSettings[key];
    }
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYER_SETTINGS, JSON.stringify(allSettings));
  }

  static async remove(source: string, id: string): Promise<void> {
    const allSettings = await this.getAll();
    delete allSettings[generateKey(source, id)];
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYER_SETTINGS, JSON.stringify(allSettings));
  }

  static async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.PLAYER_SETTINGS);
  }
}

// --- FavoriteManager (Dynamic: API or LocalStorage) ---
export class FavoriteManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  static async getAll(): Promise<Record<string, Favorite>> {
    if (this.getStorageType() === "localstorage") {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
        return data ? JSON.parse(data) : {};
      } catch (error) {
        console.info("Failed to get all local favorites:", error);
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

// --- PlayRecordManager (Dynamic: API or LocalStorage) ---
export class PlayRecordManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  static async getAll(): Promise<Record<string, PlayRecord>> {
    let apiRecords: Record<string, PlayRecord> = {};
    if (this.getStorageType() === "localstorage") {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAY_RECORDS);
        apiRecords = data ? JSON.parse(data) : {};
      } catch (error) {
        console.info("Failed to get all local play records:", error);
        return {};
      }
    } else {
      apiRecords = await api.getPlayRecords();
    }

    const localSettings = await PlayerSettingsManager.getAll();
    const mergedRecords: Record<string, PlayRecord> = {};
    for (const key in apiRecords) {
      mergedRecords[key] = {
        ...apiRecords[key],
        ...localSettings[key],
      };
    }
    return mergedRecords;
  }

  static async save(source: string, id: string, record: Omit<PlayRecord, "save_time">): Promise<void> {
    const key = generateKey(source, id);
    const { introEndTime, outroStartTime, ...apiRecord } = record;

    // Player settings are always saved locally
    await PlayerSettingsManager.save(source, id, { introEndTime, outroStartTime });

    if (this.getStorageType() === "localstorage") {
      const allRecords = await this.getAll();
      const fullRecord = { ...apiRecord, save_time: Date.now() };
      allRecords[key] = { ...allRecords[key], ...fullRecord };
      await AsyncStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(allRecords));
    } else {
      await api.savePlayRecord(key, apiRecord);
    }
  }

  static async get(source: string, id: string): Promise<PlayRecord | null> {
    const key = generateKey(source, id);
    const records = await this.getAll();
    return records[key] || null;
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    await PlayerSettingsManager.remove(source, id); // Always remove local settings

    if (this.getStorageType() === "localstorage") {
      const allRecords = await this.getAll();
      delete allRecords[key];
      await AsyncStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(allRecords));
    } else {
      await api.deletePlayRecord(key);
    }
  }

  static async clearAll(): Promise<void> {
    await PlayerSettingsManager.clearAll(); // Always clear local settings

    if (this.getStorageType() === "localstorage") {
      await AsyncStorage.removeItem(STORAGE_KEYS.PLAY_RECORDS);
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
        console.info("Failed to get local search history:", error);
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
      console.info("Failed to get settings:", error);
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
