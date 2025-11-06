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

  // 规则1：优先尝试移除常见的后缀，例如 "之..."、"第X季"、"S2"、"粤语"、"剧场版" 等
  // 这个规则现在也处理带空格和数字的标题，并且不区分大小写
  const suffixMatch = title.match(/^(.*?)(?:\s*(?:之.+|第[一二三四五六七八九十\d]+[季部]|S\d+|Season\s*\d+|粤语|国语|剧场版|预告片))$/i);
  if (suffixMatch && suffixMatch[1] && suffixMatch[1].trim().length >= 2) {
    return suffixMatch[1].trim();
  }

  // 规则2：如果后缀不匹配，并且标题包含字母或数字，则尝试提取开头的中文部分
  // 这对于 "庆余年2" 或 "三体 The Three-Body Problem" 这样的标题很有效
  const hasOtherChars = /[a-zA-Z\d]/.test(title);
  const chinesePartMatch = title.match(/^[\u4e00-\u9fa5]+/);
  if (hasOtherChars && chinesePartMatch && chinesePartMatch[0]) {
    return chinesePartMatch[0];
  }

  // 默认返回原始标题
  return title;
}
