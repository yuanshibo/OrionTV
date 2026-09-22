import { getSearchTermFromTitle } from '../searchUtils';

describe('getSearchTermFromTitle', () => {
  it('handles empty input gracefully', () => {
    expect(getSearchTermFromTitle('')).toBe('');
    expect(getSearchTermFromTitle(null as any)).toBe('');
  });

  it('extracts root title from standard seasons', () => {
    expect(getSearchTermFromTitle('间谍过家家第一季')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 第一季')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 第二季')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 第三季')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 第1季')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 第2季')).toBe('间谍过家家');
  });

  it('handles bracketed and special formats', () => {
    expect(getSearchTermFromTitle('间谍过家家(第一季)')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家（第一季）')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 [第1季]')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 Part 2')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 Season 2')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 S2')).toBe('间谍过家家');
    expect(getSearchTermFromTitle('间谍过家家 剧场版')).toBe('间谍过家家');
  });

  it('handles trailing digits or numbers', () => {
    expect(getSearchTermFromTitle('庆余年 2')).toBe('庆余年');
    expect(getSearchTermFromTitle('庆余年2')).toBe('庆余年');
    expect(getSearchTermFromTitle('画江湖之不良人6')).toBe('画江湖之不良人');
  });

  it('handles special edition suffixes', () => {
    expect(getSearchTermFromTitle('进击的巨人 完结篇')).toBe('进击的巨人');
    expect(getSearchTermFromTitle('咒术回战 前传')).toBe('咒术回战');
  });

  it('returns original title when no rule applies', () => {
    expect(getSearchTermFromTitle('千与千寻')).toBe('千与千寻');
    expect(getSearchTermFromTitle('肖申克的救赎')).toBe('肖申克的救赎');
  });
});
