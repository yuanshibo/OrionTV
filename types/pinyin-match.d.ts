declare module 'pinyin-match' {
  /**
   * 拼音匹配引擎
   * @param input 目标汉字文本
   * @param pattern 拼音或拼音首字母匹配串
   * @returns 命中时返回匹配的起始和结束索引区间 [start, end]，未命中返回 false
   */
  function match(input: string, pattern: string): [number, number] | false;

  export default { match };
  export { match };
}
