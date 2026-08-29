import AsyncStorage from "@react-native-async-storage/async-storage";
import { IStorageDriver } from "./IStorageDriver";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("AsyncStorageDriver");

export class AsyncStorageDriver<T> implements IStorageDriver<T> {
  constructor(private storageKey: string) {}

  async getAll(): Promise<Record<string, T>> {
    try {
      const data = await AsyncStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      logger.debug(`Failed to get all from ${this.storageKey}:`, error);
      return {};
    }
  }

  async get(key: string): Promise<T | null> {
    const all = await this.getAll();
    return all[key] ?? null;
  }

  async save(key: string, item: T): Promise<void> {
    try {
      const all = await this.getAll();
      all[key] = item;
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(all));
    } catch (error) {
      logger.error(`Failed to save key "${key}" to ${this.storageKey}:`, error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const all = await this.getAll();
      delete all[key];
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(all));
    } catch (error) {
      logger.error(`Failed to remove key "${key}" from ${this.storageKey}:`, error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.storageKey);
    } catch (error) {
      logger.error(`Failed to clear ${this.storageKey}:`, error);
    }
  }
}

