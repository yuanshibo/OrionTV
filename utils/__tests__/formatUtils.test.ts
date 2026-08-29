import { formatTime, formatRelativeTime, formatProgressText } from "../formatUtils";

describe("formatUtils", () => {
  describe("formatTime", () => {
    it("handles zero and invalid inputs gracefully", () => {
      expect(formatTime(0)).toBe("00:00");
      expect(formatTime(null)).toBe("00:00");
      expect(formatTime(undefined)).toBe("00:00");
      expect(formatTime(-100)).toBe("00:00");
    });

    it("formats minutes and seconds correctly", () => {
      expect(formatTime(65 * 1000)).toBe("01:05");
      expect(formatTime(599 * 1000)).toBe("09:59");
    });

    it("formats hours, minutes, and seconds correctly", () => {
      expect(formatTime((3600 + 125) * 1000)).toBe("01:02:05");
      expect(formatTime((3600 * 12 + 60) * 1000)).toBe("12:01:00");
    });
  });

  describe("formatRelativeTime", () => {
    it("handles null / undefined / zero timestamps", () => {
      expect(formatRelativeTime(null)).toBeNull();
      expect(formatRelativeTime(undefined)).toBeNull();
      expect(formatRelativeTime(0)).toBeNull();
    });

    it("returns '刚刚' for timestamps within 1 minute", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 30 * 1000)).toBe("刚刚");
    });

    it("returns minutes and hours ago accurately", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 15 * 60 * 1000)).toBe("15分钟前");
      expect(formatRelativeTime(now - 3 * 3600 * 1000)).toBe("3小时前");
    });
  });

  describe("formatProgressText", () => {
    it("returns '已看完' when completed", () => {
      expect(formatProgressText({ isCompleted: true, progress: 1 })).toBe("已看完");
    });

    it("returns next episode continuation text when current episode is finished", () => {
      expect(
        formatProgressText({
          isEpisodeFinished: true,
          episodeIndex: 2,
          totalEpisodes: 10,
        })
      ).toBe("续播第 3 集");
    });

    it("returns formatted percentage and episode index", () => {
      expect(
        formatProgressText({
          progress: 0.45,
          episodeIndex: 4,
          totalEpisodes: 12,
        })
      ).toBe("第4集 · 已看45%");

      expect(
        formatProgressText({
          progress: 0.8,
        })
      ).toBe("已看80%");
    });
  });
});
