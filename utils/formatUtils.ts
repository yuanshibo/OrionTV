/**
 * formatUtils.ts
 *
 * Unified formatting utilities for time, dates, and video playback progress across Mobile, Tablet, and TV.
 */

/**
 * Format milliseconds into MM:SS or HH:MM:SS string.
 */
export function formatTime(milliseconds?: number | null): string {
  if (!milliseconds || isNaN(milliseconds) || milliseconds <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format timestamp into human-readable relative time string.
 */
export function formatRelativeTime(timestamp?: number | null): string | null {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) return null;

  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 0) return "刚刚";
  if (diff < 60 * 1000) return "刚刚";

  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) return `${minutes}分钟前`;

  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours}小时前`;

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export interface ProgressTextOptions {
  progress?: number;
  episodeIndex?: number;
  totalEpisodes?: number;
  isCompleted?: boolean;
  isEpisodeFinished?: boolean;
}

/**
 * Format video card playback status into unified user-friendly text.
 */
export function formatProgressText({
  progress,
  episodeIndex,
  totalEpisodes,
  isCompleted,
  isEpisodeFinished,
}: ProgressTextOptions): string {
  if (isCompleted) {
    return "已看完";
  }

  if (isEpisodeFinished && totalEpisodes && episodeIndex && episodeIndex < totalEpisodes) {
    return `续播第 ${episodeIndex + 1} 集`;
  }

  if (progress !== undefined && progress > 0) {
    const percent = `${Math.round(progress * 100)}%`;
    if (episodeIndex && (totalEpisodes === undefined || totalEpisodes > 1)) {
      return `第${episodeIndex}集 · 已看${percent}`;
    }
    return `已看${percent}`;
  }

  return "";
}
