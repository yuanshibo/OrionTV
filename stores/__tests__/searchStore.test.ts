import { useSearchStore } from "../searchStore";
import { api } from "@/services/api";

jest.mock("@/services/api", () => ({
  api: {
    discover: jest.fn(),
    aiAssistantSearch: jest.fn(),
    searchVideos: jest.fn(),
  },
}));

describe("searchStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.aiAssistantSearch as jest.Mock).mockResolvedValue({ results: [] });
    useSearchStore.getState().resetSearch();
  });

  afterEach(() => {
    useSearchStore.getState().resetSearch();
  });

  it("handles appendChar, deleteChar, and clearKeyword", () => {
    const store = useSearchStore.getState();

    store.appendChar("K");
    expect(useSearchStore.getState().keyword).toBe("K");

    store.appendChar("B");
    expect(useSearchStore.getState().keyword).toBe("KB");

    store.deleteChar();
    expect(useSearchStore.getState().keyword).toBe("K");

    store.clearKeyword();
    expect(useSearchStore.getState().keyword).toBe("");
  });

  it("filters discoverList by pinyin instantly on handlePinyinInput", async () => {
    (api.discover as jest.Mock).mockResolvedValueOnce({
      list: [
        { id: "1", title: "狂飙", year: "2023", cover: "poster1.jpg" },
        { id: "2", title: "流浪地球", year: "2023", cover: "poster2.jpg" },
        { id: "3", title: "长津湖", year: "2021", cover: "poster3.jpg" },
      ],
    });

    await useSearchStore.getState().loadDiscoverData(1);

    expect(useSearchStore.getState().discoverList.length).toBe(3);
    expect(useSearchStore.getState().results.length).toBe(3);

    // Instant local pinyin match
    useSearchStore.getState().handlePinyinInput("kb");

    const matched = useSearchStore.getState().results;
    expect(matched.length).toBe(1);
    expect(matched[0].title).toBe("狂飙");

    // Clearing keyword restores the full discover list
    useSearchStore.getState().handlePinyinInput("");
    expect(useSearchStore.getState().results.length).toBe(3);
  });
});
