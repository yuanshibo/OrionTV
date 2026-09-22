import { SearchResult, DoubanRecommendationItem } from "@/services/api";

/**
 * 从视频标题中提取用于搜索的关键词。
 * 规则如下：
 * 1. 优先尝试移除常见的后缀（如 "之..."、"第X季"、"S2"、"粤语"、"剧场版"等）。
 * 2. 如果没有匹配到后缀，并且标题是中英或中数混合，则尝试提取开头的中文部分。
 * 3. 如果以上规则不适用，则返回原标题。
 *
 * @param title 视频标题
 * @returns 清理后的搜索关键词
 */
export function getSearchTermFromTitle(title: string): string {
  if (!title) {
    return "";
  }

  const trimmed = title.trim();

  // 规则0：处理“完结篇”、“前传”、“后传”等特定后缀（支持括号与空格）
  const specialEditionMatch = trimmed.match(/^(.*?)(?:[\s(（\[【]*(?:完结篇|前传|后传)[\s)）\]】]*)$/);
  if (specialEditionMatch && specialEditionMatch[1] && specialEditionMatch[1].trim().length >= 2) {
    return specialEditionMatch[1].trim();
  }

  // 规则1：优先尝试移除常见的版本/季度后缀，例如 "第X季/部/期/篇"、"S2"、"Season 2"、"Part 2"、"粤语"、"剧场版" 等（支持括号与空格）
  const suffixMatch = trimmed.match(
    /^(.*?)(?:[\s(（\[【]*(?:第[一二三四五六七八九十\d]+[季部期篇]|S\d+|Season\s*\d+|Part\s*\d+|粤语|国语|普通话|剧场版|预告片)[\s)）\]】]*)$/i
  );
  if (suffixMatch && suffixMatch[1] && suffixMatch[1].trim().length >= 2) {
    return suffixMatch[1].trim();
  }

  // 规则2：移除末尾单纯的数字标识（如 “庆余年 2”、“庆余年2”、“画江湖之不良人6”）
  const trailingNumMatch = trimmed.match(/^(.*?)(?:[\s(（\[【]*\d+[\s)）\]】]*)$/);
  if (trailingNumMatch && trailingNumMatch[1] && trailingNumMatch[1].trim().length >= 2) {
    return trailingNumMatch[1].trim();
  }

  // 规则3：如果后缀不匹配，并且标题包含字母或数字，则尝试提取开头的中文部分
  // 这对于 "庆余年2" 或 "三体 The Three-Body Problem" 这样的标题很有效
  const hasOtherChars = /[a-zA-Z\d]/.test(trimmed);
  const chinesePartMatch = trimmed.match(/^[\u4e00-\u9fa5]+/);
  if (hasOtherChars && chinesePartMatch && chinesePartMatch[0] && chinesePartMatch[0].length >= 2) {
    return chinesePartMatch[0];
  }

  // 默认返回原始标题
  return trimmed;
}

export interface VideoCardViewModel {
  id: string;
  source: string;
  title: string;
  poster: string;
  year?: string;
  rate?: string;
  sourceName?: string;
  type?: string;
  originalItem: SearchResult | DoubanRecommendationItem;
}

export const normalizeSearchResult = (item: SearchResult | DoubanRecommendationItem, index: number): VideoCardViewModel => {
  const isSearchResult = 'source' in item;
  if (isSearchResult) {
    const searchItem = item as SearchResult;
    return {
      id: searchItem.id?.toString() || `${searchItem.title}-${index}`,
      source: searchItem.source,
      title: searchItem.title,
      poster: searchItem.poster,
      year: searchItem.year,
      sourceName: searchItem.source_name,
      originalItem: item,
    };
  } else {
    const doubanItem = item as DoubanRecommendationItem;
    return {
      id: doubanItem.id?.toString() || `${doubanItem.title}-${index}`,
      source: doubanItem.url || '',
      title: doubanItem.title,
      poster: doubanItem.poster,
      year: doubanItem.year,
      sourceName: doubanItem.platform || '',
      rate: doubanItem.rate,
      originalItem: item,
    };
  }
};
