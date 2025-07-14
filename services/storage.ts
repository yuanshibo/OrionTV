import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, PlayRecord as ApiPlayRecord, Favorite as ApiFavorite } from "./api";

// --- Storage Keys ---
const STORAGE_KEYS = {
  SETTINGS: "mytv_settings",
} as const;

// --- Type Definitions (aligned with api.ts) ---
// Re-exporting for consistency, though they are now primarily API types
export type PlayRecord = ApiPlayRecord & {
  introEndTime?: number;
  outroStartTime?: number;
};
export type Favorite = ApiFavorite;

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

// --- FavoriteManager (Refactored to use API) ---
export class FavoriteManager {
  static async getAll(): Promise<Record<string, Favorite>> {
    return (await api.getFavorites()) as Record<string, Favorite>;
  }

  static async save(source: string, id: string, item: Omit<Favorite, "save_time">): Promise<void> {
    const key = generateKey(source, id);
    await api.addFavorite(key, item);
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    await api.deleteFavorite(key);
  }

  static async isFavorited(source: string, id: string): Promise<boolean> {
    const key = generateKey(source, id);
    const favorite = await api.getFavorites(key);
    return favorite !== null;
  }

  static async toggle(source: string, id: string, item: Omit<Favorite, "save_time">): Promise<boolean> {
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
    await api.deleteFavorite();
  }
}

// --- PlayRecordManager (Refactored to use API) ---
export class PlayRecordManager {
  static async getAll(): Promise<Record<string, PlayRecord>> {
    return (await api.getPlayRecords()) as Record<string, PlayRecord>;
  }

  static async save(source: string, id: string, record: Omit<PlayRecord, "save_time">): Promise<void> {
    const key = generateKey(source, id);
    // The API will handle setting the save_time
    await api.savePlayRecord(key, record);
  }

  static async get(source: string, id: string): Promise<PlayRecord | null> {
    const records = await this.getAll();
    return records[generateKey(source, id)] || null;
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    await api.deletePlayRecord(key);
  }

  static async clearAll(): Promise<void> {
    await api.deletePlayRecord();
  }
}

// --- SearchHistoryManager (Refactored to use API) ---
export class SearchHistoryManager {
  static async get(): Promise<string[]> {
    return api.getSearchHistory();
  }

  static async add(keyword: string): Promise<void> {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    await api.addSearchHistory(trimmed);
  }

  static async clear(): Promise<void> {
    await api.deleteSearchHistory();
  }
}

// --- SettingsManager (Remains unchanged, uses AsyncStorage) ---
export class SettingsManager {
  static async get(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      apiBaseUrl: "",
      remoteInputEnabled: true,
      videoSource: {
        enabledAll: true,
        sources: {},
      },
      m3uUrl:
        "https://ghfast.top/https://raw.githubusercontent.com/sjnhnp/adblock/refs/heads/main/filtered_http_only_valid.m3u",
    };
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch (error) {
      console.error("Failed to get settings:", error);
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
