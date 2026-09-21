import { homeService, KIDS_TAG_TO_DOUBAN } from "../HomeService";
import { initialCategories, DOUBAN_FILTERS_METADATA } from "../homeConfig";
import { api } from "@/services/api";

jest.mock("@/services/api", () => ({
  api: {
    getDoubanData: jest.fn(),
    getDoubanRecommendations: jest.fn(),
  },
}));

describe("HomeService and homeConfig (Kids / Animation)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initialCategories configuration", () => {
    it("should include a dedicated '少儿' category with proper sub-tags", () => {
      const kidsCategory = initialCategories.find((c) => c.title === "少儿");
      expect(kidsCategory).toBeDefined();
      expect(kidsCategory?.type).toBe("tv");
      expect(kidsCategory?.tags).toEqual([
        "全部",
        "少儿",
        "益智",
        "国产动画",
        "日本动画",
        "欧美动画",
        "迪士尼",
        "动画电影",
      ]);
      // Default initialized tag should be "全部"
      expect(kidsCategory?.tag).toBe("全部");
    });

    it("should include '动画' in '电影' tags", () => {
      const movieCategory = initialCategories.find((c) => c.title === "电影");
      expect(movieCategory).toBeDefined();
      expect(movieCategory?.tags).toContain("动画");
    });

    it("should include '动画' and '少儿' in tv filter options", () => {
      const categoryGroup = DOUBAN_FILTERS_METADATA.tv.find((g) => g.key === "category");
      expect(categoryGroup).toBeDefined();
      const optionValues = categoryGroup?.options.map((o) => o.value);
      expect(optionValues).toContain("动画");
      expect(optionValues).toContain("少儿");
    });

    it("should include '动画' and '儿童' in movie filter options", () => {
      const categoryGroup = DOUBAN_FILTERS_METADATA.movie.find((g) => g.key === "category");
      expect(categoryGroup).toBeDefined();
      const optionValues = categoryGroup?.options.map((o) => o.value);
      expect(optionValues).toContain("动画");
      expect(optionValues).toContain("儿童");
    });
  });

  describe("fetchDoubanCategoryContent smart tag routing", () => {
    it("should route all kids tags to their optimal Douban type and tag", async () => {
      const testCases = [
        { tag: "全部", expectedType: "movie", expectedTag: "动画", title: "千与千寻" },
        { tag: "少儿", expectedType: "movie", expectedTag: "少儿", title: "小猪佩奇" },
        { tag: "益智", expectedType: "movie", expectedTag: "益智", title: "萌鸡小队" },
        { tag: "国产动画", expectedType: "movie", expectedTag: "国产动画", title: "熊出没" },
        { tag: "欧美动画", expectedType: "movie", expectedTag: "欧美动画", title: "猫和老鼠" },
        { tag: "迪士尼", expectedType: "movie", expectedTag: "迪士尼", title: "疯狂动物城" },
        { tag: "动画电影", expectedType: "movie", expectedTag: "动画", title: "狮子王" },
        { tag: "日本动画", expectedType: "tv", expectedTag: "日本动画", title: "名侦探柯南" },
      ];

      for (const tc of testCases) {
        (api.getDoubanData as jest.Mock).mockResolvedValueOnce({
          list: [{ title: tc.title, poster: "url" }],
        });

        const result = await homeService.fetchDoubanCategoryContent(
          { title: "少儿", type: "tv", tag: tc.tag },
          0
        );

        expect(api.getDoubanData).toHaveBeenCalledWith(
          tc.expectedType,
          tc.expectedTag,
          20,
          0,
          undefined
        );
        expect(result.items.length).toBe(1);
        expect(result.items[0].title).toBe(tc.title);
      }
    });

    it("should preserve standard routing for other categories", async () => {
      (api.getDoubanData as jest.Mock).mockResolvedValueOnce({
        list: [{ title: "黑神话", poster: "url" }],
      });

      await homeService.fetchDoubanCategoryContent(
        { title: "电视剧", type: "tv", tag: "国产剧" },
        0
      );

      expect(api.getDoubanData).toHaveBeenCalledWith("tv", "国产剧", 20, 0, undefined);
    });
  });
});
