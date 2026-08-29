import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("SyncQueue");
const SYNC_QUEUE_KEY = "mytv_pending_sync_queue";

export interface SyncTask {
  id: string;
  type: "save_favorite" | "delete_favorite" | "save_play_record" | "delete_play_record";
  key: string;
  payload?: any;
  createdAt: number;
}

export class SyncQueue {
  private static isFlushing = false;

  static async getQueue(): Promise<SyncTask[]> {
    try {
      const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async enqueue(task: Omit<SyncTask, "id" | "createdAt">): Promise<void> {
    try {
      const queue = await this.getQueue();
      const newTask: SyncTask = {
        ...task,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
      };
      // Deduplicate pending actions on the same key within the same entity domain
      const isFavoriteAction = task.type === "save_favorite" || task.type === "delete_favorite";
      const isRecordAction = task.type === "save_play_record" || task.type === "delete_play_record";

      const filtered = queue.filter(t => {
        if (t.key !== task.key) return true;
        if (isFavoriteAction && (t.type === "save_favorite" || t.type === "delete_favorite")) return false;
        if (isRecordAction && (t.type === "save_play_record" || t.type === "delete_play_record")) return false;
        return true;
      });

      filtered.push(newTask);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered.slice(-50))); // Keep max 50 pending
      logger.info(`[SyncQueue] Enqueued task: ${task.type} for key ${task.key}`);
    } catch (e) {
      logger.error("[SyncQueue] Failed to enqueue task:", e);
    }
  }

  static async flush(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      const queue = await this.getQueue();
      if (queue.length === 0) {
        this.isFlushing = false;
        return;
      }

      logger.info(`[SyncQueue] Flushing ${queue.length} pending tasks...`);
      const remainingTasks: SyncTask[] = [];

      for (const task of queue) {
        try {
          switch (task.type) {
            case "save_favorite":
              await api.addFavorite(task.key, task.payload);
              break;
            case "delete_favorite":
              await api.deleteFavorite(task.key);
              break;
            case "save_play_record":
              await api.savePlayRecord(task.key, task.payload);
              break;
            case "delete_play_record":
              await api.deletePlayRecord(task.key);
              break;
          }
        } catch {
          // If still failing (e.g. offline), retain for next flush
          remainingTasks.push(task);
        }
      }

      // Read latest queue to safely preserve items enqueued during flush cycle
      const latestQueue = await this.getQueue();
      const newlyAddedTasks = latestQueue.filter(t => !queue.some(processed => processed.id === t.id));
      const finalQueue = [...remainingTasks, ...newlyAddedTasks].slice(-50);

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(finalQueue));
      logger.info(`[SyncQueue] Flush complete. Remaining: ${finalQueue.length}`);
    } catch (e) {
      logger.error("[SyncQueue] Flush error:", e);
    } finally {
      this.isFlushing = false;
    }
  }
}
