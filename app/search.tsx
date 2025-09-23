import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, TextInput, StyleSheet, Alert, Keyboard, TouchableOpacity } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api, SearchResult } from "@/services/api";
import { Search, QrCode } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { RemoteControlModal } from "@/components/RemoteControlModal";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import { pinyin } from "pinyin-pro";
import Logger from "@/utils/Logger";
import { SearchHistoryManager } from "@/services/storage";

const LETTER_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NUMBER_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const KEYBOARD_LAYOUT = [
  LETTER_KEYS.slice(0, 9),
  LETTER_KEYS.slice(9, 18),
  LETTER_KEYS.slice(18, 26),
  NUMBER_KEYS,
];

const SPECIAL_KEY_CONFIG = [
  { label: "空格", type: "space" },
  { label: "删除", type: "delete" },
  { label: "清空", type: "clear" },
  { label: "搜索", type: "search" },
] as const;

const MAX_HISTORY_ITEMS = 20;

type SpecialKeyType = (typeof SPECIAL_KEY_CONFIG)[number]["type"];

const logger = Logger.withTag("SearchScreen");

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const pinyinCacheRef = useRef<Map<string, { full: string; initials: string }>>(new Map());
  const suggestionsRequestIdRef = useRef(0);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;
  const isTv = deviceType === "tv";

  useEffect(() => {
    if (lastMessage && targetPage === "search") {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      handleSearch(realMessage);
      clearMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage, targetPage]);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      try {
        const history = await SearchHistoryManager.get();
        if (isMounted) {
          setSearchHistory(history);
        }
      } catch (historyError) {
        logger.warn("Failed to load search history:", historyError);
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizePinyinValue = useCallback(
    (value: string) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[üǖǘǚǜ]/g, "v")
        .replace(/[^a-z]/g, ""),
    []
  );

  const getPinyinForms = useCallback(
    (text: string) => {
      if (!text) {
        return { full: "", initials: "" };
      }

      const cached = pinyinCacheRef.current.get(text);
      if (cached) {
        return cached;
      }

      try {
        const full = normalizePinyinValue(pinyin(text, { toneType: "none" }));
        const initials = normalizePinyinValue(pinyin(text, { pattern: "first", toneType: "none" }));
        const computed = { full, initials };
        pinyinCacheRef.current.set(text, computed);
        return computed;
      } catch (conversionError) {
        logger.warn("Failed to convert title to pinyin:", text, conversionError);
        const fallback = { full: "", initials: "" };
        pinyinCacheRef.current.set(text, fallback);
        return fallback;
      }
    },
    [normalizePinyinValue, pinyinCacheRef]
  );

  const buildApiQuery = useCallback((term: string) => {
    const collapsedLowerTerm = term.toLowerCase().replace(/\s+/g, "");
    const lettersOnlyTerm = collapsedLowerTerm.replace(/[^a-z]/g, "");
    const isAlphabetic = lettersOnlyTerm.length > 0 && lettersOnlyTerm === collapsedLowerTerm;
    return isAlphabetic ? lettersOnlyTerm : term;
  }, []);

  const filterResultsByKeyword = useCallback(
    (items: SearchResult[], termValue: string) => {
      const trimmedTerm = termValue.trim();
      if (!trimmedTerm) {
        return items;
      }

    const lowerTerm = trimmedTerm.toLowerCase();
    const collapsedTerm = lowerTerm.replace(/\s+/g, "");
    const lettersOnlyTerm = collapsedTerm.replace(/[^a-z]/g, "");
    const isPinyinSearch = lettersOnlyTerm.length > 0 && lettersOnlyTerm === collapsedTerm;

    if (!isPinyinSearch) {
      return items;
    }

    logger.debug("Applying pinyin filter for keyword:", termValue);

    const rankedMatches = items
      .map((item, index) => {
        const title = item.title || "";
        if (!title) {
          return { item, index, score: Number.POSITIVE_INFINITY, matched: false };
        }

        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes(lowerTerm)) {
          return { item, index, score: 0, matched: true };
        }

        const condensedTitle = lowerTitle.replace(/\s+/g, "");
        if (condensedTitle.includes(collapsedTerm)) {
          return { item, index, score: 1, matched: true };
        }

        const { full, initials } = getPinyinForms(title);

        if (initials.startsWith(lettersOnlyTerm)) {
          return { item, index, score: 2, matched: true };
        }

        if (initials.includes(lettersOnlyTerm)) {
          return { item, index, score: 3, matched: true };
        }

        if (full.startsWith(lettersOnlyTerm)) {
          return { item, index, score: 4, matched: true };
        }

        if (full.includes(lettersOnlyTerm)) {
          return { item, index, score: 5, matched: true };
        }

        return { item, index, score: Number.POSITIVE_INFINITY, matched: false };
      })
      .filter((entry) => entry.matched)
      .sort((a, b) => (a.score === b.score ? a.index - b.index : a.score - b.score))
      .map((entry) => entry.item);

      return rankedMatches;
    },
    [getPinyinForms]
  );

  useEffect(() => {
    let isActive = true;
    const currentRequestId = ++suggestionsRequestIdRef.current;

    if (!isTv) {
      setSuggestions([]);
      return () => {
        isActive = false;
      };
    }

    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setSuggestions([]);
      return () => {
        isActive = false;
      };
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const queryForApi = buildApiQuery(trimmedKeyword);
        if (!queryForApi) {
          if (isActive && suggestionsRequestIdRef.current === currentRequestId) {
            setSuggestions([]);
          }
          return;
        }

        const response = await api.searchVideos(queryForApi);
        const filteredResults = filterResultsByKeyword(response.results, trimmedKeyword);
        const uniqueTitles = Array.from(
          new Set(
            filteredResults
              .map((item) => item.title?.trim())
              .filter((title): title is string => Boolean(title))
          )
        ).slice(0, 12);

        if (isActive && suggestionsRequestIdRef.current === currentRequestId) {
          setSuggestions(uniqueTitles);
        }
      } catch (suggestionError) {
        if (isActive && suggestionsRequestIdRef.current === currentRequestId) {
          setSuggestions([]);
        }
        logger.warn("Failed to fetch search suggestions:", suggestionError);
      }
    }, 250);

    return () => {
      isActive = false;
      clearTimeout(debounceTimer);
    };
  }, [keyword, isTv, buildApiQuery, filterResultsByKeyword]);

  const updateLocalHistory = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return;
    }

    setSearchHistory((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)];
      return next.slice(0, MAX_HISTORY_ITEMS);
    });
  };

  const handleSearch = async (searchText?: string) => {
    const term = typeof searchText === "string" ? searchText : keyword;
    const trimmedTerm = term.trim();

    if (!trimmedTerm) {
      if (!searchText) {
        setResults([]);
        setError(null);
      }
      if (!isTv) {
        Keyboard.dismiss();
      }
      return;
    }

    if (!isTv) {
      Keyboard.dismiss();
    }

    setLoading(true);
    setError(null);

    try {
      const queryForApi = buildApiQuery(trimmedTerm);

      const response = await api.searchVideos(queryForApi);
      const filteredResults = filterResultsByKeyword(response.results, trimmedTerm);
      setResults(filteredResults);

      if (filteredResults.length === 0) {
        setError("没有找到相关内容");
      } else {
        setError(null);
      }

      updateLocalHistory(trimmedTerm);

      try {
        await SearchHistoryManager.add(trimmedTerm);
      } catch (historyError) {
        logger.warn("Failed to persist search history:", historyError);
      }
    } catch (err) {
      setError("搜索失败，请稍后重试。");
      setResults([]);
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearInput = () => {
    setKeyword("");
    setResults([]);
    setError(null);
    textInputRef.current?.focus?.();
  };

  const handleDeleteLastCharacter = () => {
    setKeyword((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleKeyboardAppend = (value: string) => {
    setKeyword((prev) => prev + value);
    setError(null);
  };

  const handleSpecialKeyPress = (type: SpecialKeyType) => {
    switch (type) {
      case "space":
        handleKeyboardAppend(" ");
        break;
      case "delete":
        handleDeleteLastCharacter();
        break;
      case "clear":
        handleClearInput();
        break;
      case "search":
        handleSearch();
        break;
      default:
        break;
    }
  };

  const handleHistorySelect = (value: string) => {
    setKeyword(value);
    handleSearch(value);
  };

  const handleSuggestionSelect = (value: string) => {
    setKeyword(value);
    handleSearch(value);
  };

  const handleClearHistory = async () => {
    try {
      await SearchHistoryManager.clear();
      setSearchHistory([]);
    } catch (historyError) {
      logger.warn("Failed to clear search history:", historyError);
    }
  };

  const onSearchPress = () => handleSearch();

  const handleQrPress = () => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal("search");
  };

  const renderItem = ({ item }: { item: SearchResult; index: number }) => (
    <VideoCard
      id={item.id.toString()}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      sourceName={item.source_name}
      api={api}
    />
  );

  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderSearchControls = () => (
    <View style={[dynamicStyles.section, dynamicStyles.firstSection]}>
      <View style={[dynamicStyles.sectionCard, dynamicStyles.searchCard]}>
        <View style={dynamicStyles.sectionHeaderRow}>
          <ThemedText style={dynamicStyles.sectionTitle}>全站搜索</ThemedText>
        </View>
        <View style={dynamicStyles.searchContainer}>
          <TouchableOpacity
            activeOpacity={1}
            style={[
              dynamicStyles.inputContainer,
              {
                borderColor: isInputFocused ? Colors.dark.primary : "transparent",
              },
            ]}
            onPress={() => textInputRef.current?.focus()}
          >
            <TextInput
              ref={textInputRef}
              style={dynamicStyles.input}
              placeholder="支持全拼拼音首字母搜索"
              placeholderTextColor="#888"
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={onSearchPress}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="no"
            />
          </TouchableOpacity>
          <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
            <Search size={deviceType === "mobile" ? 20 : 24} color="white" />
          </StyledButton>
          {deviceType !== "mobile" && (
            <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
              <QrCode size={deviceType === "tv" ? 24 : 20} color="white" />
            </StyledButton>
          )}
        </View>
        {isTv ? (
          <ThemedText style={dynamicStyles.searchHintText}>
            使用遥控器或扫码在电视上快速输入关键词
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  const renderHistorySection = () => {
    if (!isTv && searchHistory.length === 0) {
      return null;
    }

    const displayHistory = isTv ? searchHistory.slice(0, 10) : searchHistory.slice(0, 8);

    return (
      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.sectionCard}>
          <View style={dynamicStyles.sectionHeaderRow}>
            <ThemedText style={dynamicStyles.sectionTitle}>搜索历史</ThemedText>
            {searchHistory.length > 0 ? (
              <TouchableOpacity onPress={handleClearHistory}>
                <ThemedText style={dynamicStyles.sectionActionText}>清除</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
          {searchHistory.length > 0 ? (
            <View style={dynamicStyles.listContainer}>
              {displayHistory.map((item, index) => {
                const isPrimary = index === 0;
                return (
                  <StyledButton
                    key={item}
                    variant="ghost"
                    onPress={() => handleHistorySelect(item)}
                    style={dynamicStyles.listItem}
                    contentStyle={dynamicStyles.listItemContent}
                  >
                    <View style={dynamicStyles.listItemInner}>
                      <View
                        style={[
                          dynamicStyles.indexBadge,
                          isPrimary && dynamicStyles.indexBadgeHighlight,
                        ]}
                      >
                        <ThemedText
                          style={[
                            dynamicStyles.indexBadgeText,
                            isPrimary && dynamicStyles.indexBadgeTextHighlight,
                          ]}
                        >
                          {index + 1}
                        </ThemedText>
                      </View>
                      <ThemedText numberOfLines={1} style={dynamicStyles.listItemText}>
                        {item}
                      </ThemedText>
                    </View>
                  </StyledButton>
                );
              })}
            </View>
          ) : (
            <ThemedText style={dynamicStyles.emptyHintText}>暂无搜索历史</ThemedText>
          )}
        </View>
      </View>
    );
  };

  const renderSuggestionsSection = () => {
    if (!isTv) {
      return null;
    }

    return (
      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.sectionCard}>
          <View style={dynamicStyles.sectionHeaderRow}>
            <ThemedText style={dynamicStyles.sectionTitle}>猜你可能在找</ThemedText>
          </View>
          {suggestions.length > 0 ? (
            <View style={dynamicStyles.listContainer}>
              {suggestions.map((item) => (
                <StyledButton
                  key={item}
                  text={item}
                  variant="ghost"
                  onPress={() => handleSuggestionSelect(item)}
                  style={dynamicStyles.listItem}
                  contentStyle={dynamicStyles.listItemContent}
                  textStyle={dynamicStyles.listItemText}
                />
              ))}
            </View>
          ) : (
            <ThemedText style={dynamicStyles.emptyHintText}>
              {keyword.trim() ? "暂无相关建议" : "输入关键词查看实时建议"}
            </ThemedText>
          )}
        </View>
      </View>
    );
  };

  const renderKeyboardSection = () => {
    if (!isTv) {
      return null;
    }

    return (
      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.sectionCard}>
          <View style={dynamicStyles.sectionHeaderRow}>
            <ThemedText style={dynamicStyles.sectionTitle}>拼音键盘</ThemedText>
          </View>
          <View style={dynamicStyles.keyboardSection}>
            {KEYBOARD_LAYOUT.map((row, rowIndex) => (
              <View key={`keyboard-row-${rowIndex}`} style={dynamicStyles.keyboardRow}>
                {row.map((key) => (
                  <StyledButton
                    key={key}
                    text={key}
                    variant="ghost"
                    onPress={() => handleKeyboardAppend(key)}
                    style={dynamicStyles.keyboardKey}
                    contentStyle={dynamicStyles.keyboardKeyContent}
                    textStyle={dynamicStyles.keyboardKeyText}
                  />
                ))}
              </View>
            ))}
            <View style={[dynamicStyles.keyboardRow, dynamicStyles.keyboardSpecialRow]}>
              {SPECIAL_KEY_CONFIG.map((item) => (
                <StyledButton
                  key={item.type}
                  text={item.label}
                  variant="ghost"
                  onPress={() => handleSpecialKeyPress(item.type)}
                  style={dynamicStyles.keyboardSpecialKey}
                  contentStyle={dynamicStyles.keyboardSpecialKeyContent}
                  textStyle={dynamicStyles.keyboardSpecialKeyText}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderResultsContent = () => {
    if (loading) {
      return (
        <View style={dynamicStyles.resultsPlaceholder}>
          <VideoLoadingAnimation showProgressBar={false} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={[dynamicStyles.resultsPlaceholder, commonStyles.center]}>
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={[dynamicStyles.resultsPlaceholder, commonStyles.center]}>
          <ThemedText style={dynamicStyles.emptyText}>输入关键词开始搜索</ThemedText>
        </View>
      );
    }

    return <CustomScrollView data={results} renderItem={renderItem} numColumns={isTv ? 5 : undefined} />;
  };

  const renderResultsSection = () => {
    const trimmedKeyword = keyword.trim();
    const resultsTitle = trimmedKeyword ? `“${trimmedKeyword}”的搜索结果` : "搜索结果";
    const showCount = Boolean(trimmedKeyword && results.length > 0 && !loading && !error);
    const showSubtitle = !trimmedKeyword || (!loading && !error && results.length > 0);
    const subtitleText = !trimmedKeyword
      ? "支持拼音全拼和首字母搜索，快速定位想看的节目"
      : "按遥控器确认键打开选中的视频";

    return (
      <View style={dynamicStyles.resultsCard}>
        <View style={dynamicStyles.resultsHeader}>
          <View>
            <ThemedText style={dynamicStyles.sectionTitle}>{resultsTitle}</ThemedText>
            {showSubtitle ? (
              <ThemedText style={dynamicStyles.resultsSubtitle}>{subtitleText}</ThemedText>
            ) : null}
          </View>
          {showCount ? (
            <ThemedText style={dynamicStyles.resultsCountText}>共 {results.length} 个结果</ThemedText>
          ) : null}
        </View>
        {renderResultsContent()}
      </View>
    );
  };

  const renderSearchContent = () => (
    <>
      <View style={dynamicStyles.contentWrapper}>
        <View style={dynamicStyles.sidebar}>
          {renderSearchControls()}
          {renderHistorySection()}
          {renderSuggestionsSection()}
          {renderKeyboardSection()}
        </View>
        <View style={dynamicStyles.resultsWrapper}>{renderResultsSection()}</View>
      </View>
      <RemoteControlModal />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderSearchContent()}
    </ThemedView>
  );

  if (deviceType === "tv") {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === "mobile";
  const isTv = deviceType === "tv";
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();
  const inputHeight = isTv ? 64 : isMobile ? minTouchTarget : 56;

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: isTv ? 40 : isMobile ? spacing / 2 : spacing,
      paddingHorizontal: isTv ? spacing * 2 : spacing,
    },
    contentWrapper: {
      flex: 1,
      flexDirection: isTv ? "row" : "column",
      paddingTop: isTv ? spacing : spacing / 2,
    },
    sidebar: {
      width: isTv ? 420 : "100%",
      marginRight: isTv ? spacing * 1.5 : 0,
      marginBottom: isTv ? 0 : spacing,
    },
    section: {
      marginTop: isTv ? spacing : spacing,
    },
    firstSection: {
      marginTop: 0,
    },
    sectionCard: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: isTv ? 24 : isMobile ? 12 : 16,
      padding: isTv ? spacing : spacing * 0.75,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
    },
    searchCard: {
      paddingBottom: isTv ? spacing : spacing * 0.75,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing / 2,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing / 4,
      marginBottom: spacing / 2,
    },
    inputContainer: {
      flex: 1,
      height: inputHeight,
      backgroundColor: "#2c2c2e",
      borderRadius: isTv ? 16 : 10,
      paddingHorizontal: spacing,
      borderWidth: 2,
      borderColor: "transparent",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      color: "white",
      fontSize: isTv ? 22 : isMobile ? 16 : 18,
    },
    searchButton: {
      width: isTv ? inputHeight : isMobile ? minTouchTarget : 50,
      height: inputHeight,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isTv ? 16 : 10,
      marginLeft: spacing / 2,
    },
    qrButton: {
      width: isTv ? inputHeight : isMobile ? minTouchTarget : 50,
      height: inputHeight,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isTv ? 16 : 10,
      marginLeft: spacing / 2,
    },
    searchHintText: {
      color: "#9f9f9f",
      fontSize: isTv ? 18 : 14,
      marginTop: spacing / 2,
    },
    sectionTitle: {
      color: "white",
      fontSize: isTv ? 24 : isMobile ? 16 : 18,
      fontWeight: "600",
    },
    sectionActionText: {
      color: Colors.dark.link,
      fontSize: isTv ? 18 : 14,
    },
    listContainer: {
      marginTop: spacing / 2,
    },
    listItem: {
      width: "100%",
      marginBottom: spacing / 2,
    },
    listItemContent: {
      justifyContent: "flex-start",
      alignItems: "center",
      paddingVertical: isTv ? 14 : 10,
      width: "100%",
    },
    listItemInner: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    indexBadge: {
      minWidth: isTv ? 36 : 28,
      height: isTv ? 36 : 28,
      borderRadius: isTv ? 18 : 14,
      backgroundColor: "rgba(255, 255, 255, 0.14)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing / 2,
      paddingHorizontal: 6,
    },
    indexBadgeHighlight: {
      backgroundColor: Colors.dark.primary,
    },
    indexBadgeText: {
      color: "white",
      fontWeight: "600",
      fontSize: isTv ? 18 : 14,
    },
    indexBadgeTextHighlight: {
      color: Colors.dark.background,
    },
    listItemText: {
      flex: 1,
      color: "white",
      fontSize: isTv ? 20 : isMobile ? 14 : 16,
    },
    emptyHintText: {
      color: "#888",
      fontSize: isTv ? 18 : 14,
    },
    keyboardSection: {
      marginTop: spacing / 2,
    },
    keyboardRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing / 2,
    },
    keyboardKey: {
      flex: 1,
      marginHorizontal: spacing / 4,
    },
    keyboardKeyContent: {
      paddingVertical: isTv ? 18 : 12,
    },
    keyboardKeyText: {
      fontSize: isTv ? 22 : 16,
    },
    keyboardSpecialRow: {
      marginTop: spacing / 4,
      marginBottom: 0,
    },
    keyboardSpecialKey: {
      flex: 1,
      marginHorizontal: spacing / 4,
    },
    keyboardSpecialKeyContent: {
      paddingVertical: isTv ? 18 : 12,
    },
    keyboardSpecialKeyText: {
      fontSize: isTv ? 20 : 16,
    },
    resultsWrapper: {
      flex: 1,
      marginLeft: isTv ? spacing * 1.5 : 0,
      marginTop: isTv ? 0 : spacing,
    },
    resultsCard: {
      flex: 1,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderRadius: isTv ? 24 : isMobile ? 12 : 16,
      padding: isTv ? spacing * 1.25 : spacing,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.06)",
    },
    resultsHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: spacing,
    },
    resultsSubtitle: {
      color: "#9f9f9f",
      fontSize: isTv ? 18 : 14,
      marginTop: spacing / 4,
    },
    resultsCountText: {
      color: "#ccc",
      fontSize: isTv ? 18 : 14,
    },
    resultsPlaceholder: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing,
    },
    errorText: {
      color: "#ff7373",
      fontSize: isTv ? 18 : isMobile ? 14 : 16,
      textAlign: "center",
    },
    emptyText: {
      color: "#888",
      fontSize: isTv ? 18 : 14,
    },
  });
};
