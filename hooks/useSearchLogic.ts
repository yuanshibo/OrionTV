import { useState, useRef, useCallback } from "react";
import { Keyboard } from "react-native";
import { contentApi, SearchResult, DoubanRecommendationItem } from "@/services/api";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("useSearchLogic");

export type UnifiedResult = SearchResult | DoubanRecommendationItem;

export const useSearchLogic = (initialKeyword: string = "") => {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  const loadDiscoverData = useCallback(async (page: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await contentApi.discover(page, 25);
      if (response && response.list && response.list.length > 0) {
        setResults(prev => page === 1 ? response.list : [...prev, ...response.list]);
        setDiscoverPage(page + 1);
        setHasMore(response.list.length === 25);
      } else {
        setHasMore(false);
        if (page === 1) {
          setResults([]);
        }
      }
    } catch (err) {
      logger.info("Discover data loading failed:", err);
      setHasMore(false);
      if (page === 1) {
        setResults([]);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const doSearch = useCallback(async (term: string) => {
    const searchTerm = term.trim();
    if (!searchTerm) {
      Keyboard.dismiss();
      setResults([]); // Clear previous search results
      setDiscoverPage(1); // Reset discover page
      setHasMore(true); // Allow discover to load more
      loadDiscoverData(1);
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const { results: searchResults } = await contentApi.aiAssistantSearch(searchTerm);
      if (searchResults.length > 0) {
        setResults(searchResults);
        setHasMore(false);
      } else {
        setError("没有找到相关内容，为你推荐...");
        loadDiscoverData(1);
      }
    } catch (err) {
      setError("搜索失败，请稍后重试。");
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, [loadDiscoverData]);

  const handleLoadMore = useCallback(() => {
    if (!loadingRef.current && hasMore && keyword.trim() === "") {
      loadDiscoverData(discoverPage);
    }
  }, [hasMore, keyword, discoverPage, loadDiscoverData]);

  return {
    keyword,
    setKeyword,
    results,
    loading,
    loadingMore,
    error,
    hasMore,
    doSearch,
    loadDiscoverData,
    handleLoadMore,
  };
};
