export interface IStorageDriver<T> {
  getAll(): Promise<Record<string, T>>;
  get(key: string): Promise<T | null>;
  save(key: string, item: T): Promise<void>;
  remove(key: string): Promise<void>;
  clearAll(): Promise<void>;
}
