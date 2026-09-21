import PinyinMatch from "pinyin-match";

export interface PinyinMatchResult<T> {
  item: T;
  range: [number, number];
  score: number;
}

/**
 * 拼音首字母与全拼模糊匹配辅助工具
 */
export class PinyinHelper {
  /**
   * 判断目标文本是否匹配拼音首字母、全拼或汉字包含
   * @param text 目标文本（如“狂飙”）
   * @param pattern 检索模式（如“kb”、“kuang”或“狂”）
   * @returns 匹配成功返回 [start, end] 命中索引区间，否则返回 false
   */
  static match(text: string, pattern: string): [number, number] | false {
    if (!text || !pattern) return false;
    const cleanPattern = pattern.trim().toLowerCase();
    if (!cleanPattern) return false;

    // 1. 汉字直接包含判断（大小写不敏感）
    const cleanText = text.toLowerCase();
    const directIndex = cleanText.indexOf(cleanPattern);
    if (directIndex !== -1) {
      return [directIndex, directIndex + cleanPattern.length - 1];
    }

    // 2. 拼音首字母 / 全拼匹配
    const matchRes = PinyinMatch.match(text, cleanPattern);
    if (matchRes) {
      return matchRes;
    }

    return false;
  }

  /**
   * 计算匹配得分，用于排序
   * @param text 目标文本
   * @param pattern 检索词
   * @param range 命中区间
   */
  static calculateScore(text: string, pattern: string, range: [number, number]): number {
    const cleanPattern = pattern.trim().toLowerCase();
    const [start, end] = range;
    const matchLength = end - start + 1;

    let score = 0;

    // 前缀命中加分（从首字开始命中）
    if (start === 0) {
      score += 50;
      // 且整个词长度与模式相近（精准完全命中，如“狂飙”匹配“kb”）
      if (text.length <= cleanPattern.length + 1) {
        score += 40;
      }
    } else {
      score += 20;
    }

    // 命中长度占比加分
    const coverage = matchLength / Math.max(text.length, 1);
    score += Math.round(coverage * 20);

    return score;
  }

  /**
   * 过滤并对数组进行拼音匹配加权排序
   * @param items 目标数组
   * @param pattern 检索词
   * @param getTitle 提取文本的回调
   */
  static filterAndRank<T>(
    items: T[],
    pattern: string,
    getTitle: (item: T) => string
  ): PinyinMatchResult<T>[] {
    if (!pattern || !pattern.trim()) {
      return items.map((item) => ({ item, range: [0, 0], score: 0 }));
    }

    const cleanPattern = pattern.trim().toLowerCase();
    const matchedList: PinyinMatchResult<T>[] = [];

    for (const item of items) {
      const title = getTitle(item);
      if (!title) continue;

      const range = this.match(title, cleanPattern);
      if (range) {
        const score = this.calculateScore(title, cleanPattern, range);
        matchedList.push({ item, range, score });
      }
    }

    // 排序优先级：
    // 1. 匹配得分高的在前（前缀匹配 > 中间匹配）
    // 2. 得分相同时，标题更短的在前（更加精准）
    return matchedList.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return getTitle(a.item).length - getTitle(b.item).length;
    });
  }
}
