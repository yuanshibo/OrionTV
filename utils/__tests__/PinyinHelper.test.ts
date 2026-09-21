import { PinyinHelper } from "../PinyinHelper";

describe("PinyinHelper", () => {
  describe("match", () => {
    it("matches Chinese titles with pinyin initials", () => {
      const res = PinyinHelper.match("狂飙", "kb");
      expect(res).toBeTruthy();
      if (res) {
        expect(res[0]).toBe(0);
        expect(res[1]).toBe(1);
      }
    });

    it("matches polyphonic Chinese characters (多音字)", () => {
      // 重: chong / zhong
      const resChong = PinyinHelper.match("重案六组", "calz");
      const resZhong = PinyinHelper.match("重案六组", "zalz");
      expect(resChong).toBeTruthy();
      expect(resZhong).toBeTruthy();
    });

    it("matches full pinyin and partial pinyin", () => {
      const resFull = PinyinHelper.match("流浪地球", "liulangdiqiu");
      const resPartial = PinyinHelper.match("流浪地球", "liulang");
      expect(resFull).toBeTruthy();
      expect(resPartial).toBeTruthy();
    });

    it("matches direct Chinese characters", () => {
      const res = PinyinHelper.match("狂飙", "狂");
      expect(res).toEqual([0, 0]);
    });

    it("returns false for non-matching patterns", () => {
      const res = PinyinHelper.match("狂飙", "xyz");
      expect(res).toBe(false);
    });

    it("handles empty or falsy inputs gracefully", () => {
      expect(PinyinHelper.match("", "kb")).toBe(false);
      expect(PinyinHelper.match("狂飙", "")).toBe(false);
      expect(PinyinHelper.match("狂飙", "   ")).toBe(false);
    });
  });

  describe("filterAndRank", () => {
    const mockList = [
      { id: "1", title: "无间道之狂飙风云" },
      { id: "2", title: "狂飙" },
      { id: "3", title: "流浪地球" },
      { id: "4", title: "狂人日记" },
    ];

    it("filters items by pinyin initials and ranks exact prefix higher", () => {
      const results = PinyinHelper.filterAndRank(mockList, "kb", (item) => item.title);
      expect(results.length).toBe(2);
      // "狂飙" (prefix & exact length match) should rank before "无间道之狂飙风云"
      expect(results[0].item.id).toBe("2");
      expect(results[0].item.title).toBe("狂飙");
      expect(results[1].item.id).toBe("1");
    });

    it("returns all items when pattern is empty", () => {
      const results = PinyinHelper.filterAndRank(mockList, "", (item) => item.title);
      expect(results.length).toBe(mockList.length);
    });
  });
});
