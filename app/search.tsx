import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableOpacity,
  Pressable,
  Animated,
} from "react-native";
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

const logger = Logger.withTag("SearchScreen");

type FocusSection = "input" | "keyboard" | "middle" | "results";

type KeyboardKey = {
  id: string;
  label: string;
  value?: string;
  action?: "delete" | "clear";
};

const KEYBOARD_LAYOUT: KeyboardKey[][] = [
  [
    { id: "clear", label: "清空", action: "clear" },
    { id: "delete", label: "删除", action: "delete" },
  ],
  [
    { id: "A", label: "A" },
    { id: "B", label: "B" },
    { id: "C", label: "C" },
    { id: "D", label: "D" },
    { id: "E", label: "E" },
    { id: "F", label: "F" },
  ],
  [
    { id: "G", label: "G" },
    { id: "H", label: "H" },
    { id: "I", label: "I" },
    { id: "J", label: "J" },
    { id: "K", label: "K" },
    { id: "L", label: "L" },
  ],
  [
    { id: "M", label: "M" },
    { id: "N", label: "N" },
    { id: "O", label: "O" },
    { id: "P", label: "P" },
    { id: "Q", label: "Q" },
    { id: "R", label: "R" },
  ],
  [
    { id: "S", label: "S" },
    { id: "T", label: "T" },
    { id: "U", label: "U" },
    { id: "V", label: "V" },
    { id: "W", label: "W" },
    { id: "X", label: "X" },
  ],
  [
    { id: "Y", label: "Y" },
    { id: "Z", label: "Z" },
    { id: "0", label: "0" },
    { id: "1", label: "1" },
    { id: "2", label: "2" },
    { id: "3", label: "3" },
  ],
  [
    { id: "4", label: "4" },
    { id: "5", label: "5" },
    { id: "6", label: "6" },
    { id: "7", label: "7" },
    { id: "8", label: "8" },
    { id: "9", label: "9" },
  ],
];

const MAX_SUGGESTIONS = 8;
const SEARCH_DEBOUNCE = 320;

interface PinyinRepresentation {
  lower: string;
  plain: string;
  initials: string;
  full: string;
}

const sanitizeQuery = (value: string) => value.replace(/\s+/g, "").toLowerCase();

const sanitizePlainText = (value: string) => value.replace(/[\s·•・•]/g, "").toLowerCase();

const buildPinyinRepresentation = (text: string): PinyinRepresentation => {
  const normalized = text ?? "";
  const lower = normalized.toLowerCase();
  const plain = sanitizePlainText(normalized);

  let full = "";
  let initials = "";

  try {
    const fullArray = pinyin(normalized, {
      pattern: "pinyin",
      toneType: "none",
      type: "array",
    }) as string[];
    full = fullArray.join("").toLowerCase();

    const firstArray = pinyin(normalized, {
      pattern: "first",
      type: "array",
    }) as string[];
    initials = firstArray.join("").toUpperCase();
  } catch (err) {
    logger.debug("Failed to convert text to pinyin", err);
  }

  return { lower, plain, initials, full };
};

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focusSection, setFocusSection] = useState<FocusSection>("input");
  const [isInputFocused, setIsInputFocused] = useState(false);

  const textInputRef = useRef<TextInput>(null);
  const centerFlex = useRef(new Animated.Value(DeviceUtils.getDeviceType() === "tv" ? 0.9 : 1)).current;
  const resultsFlex = useRef(new Animated.Value(DeviceUtils.getDeviceType() === "tv" ? 1.8 : 1)).current;
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const skipNextAutoSearch = useRef(false);
  const searchAbortController = useRef<AbortController | null>(null);
  const pinyinCacheRef = useRef<Map<string, PinyinRepresentation>>(new Map());

  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType, spacing), [deviceType, spacing]);

  const getRepresentation = useCallback((title: string) => {
    const cacheKey = title ?? "";
    const cached = pinyinCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }
    const computed = buildPinyinRepresentation(cacheKey);
    pinyinCacheRef.current.set(cacheKey, computed);
    return computed;
  }, []);

  const filterResultsByKeyword = useCallback(
    (items: SearchResult[], term: string) => {
      const normalizedQuery = sanitizeQuery(term);
      if (!normalizedQuery) {
        return items;
      }
      const uppercaseQuery = normalizedQuery.toUpperCase();

      return items.filter((item) => {
        const representation = getRepresentation(item.title);
        if (representation.lower.includes(normalizedQuery)) return true;
        if (representation.plain.includes(normalizedQuery)) return true;
        if (representation.initials && representation.initials.includes(uppercaseQuery)) return true;
        if (representation.full && representation.full.includes(normalizedQuery)) return true;

        const additional = [item.source_name, item.class, item.desc, item.year];
        return additional.some((value) => {
          if (!value) return false;
          return value.toLowerCase().includes(normalizedQuery);
        });
      });
    },
    [getRepresentation]
  );

  const buildSuggestionList = useCallback((items: SearchResult[], term: string) => {
    const normalizedTerm = term.trim();
    const seen = new Set<string>();
    const list: string[] = [];

    for (const item of items) {
      const title = item.title?.trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      if (title !== normalizedTerm) {
        list.push(title);
      }
      if (list.length >= MAX_SUGGESTIONS) break;
    }

    return list;
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const stored = await api.getSearchHistory();
      setHistory(stored);
    } catch (err) {
      logger.info("Failed to load search history", err);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const updateHistory = useCallback(async (term: string) => {
    try {
      const updated = await api.addSearchHistory(term);
      setHistory(updated);
    } catch (historyError) {
      logger.info("Failed to update search history", historyError);
    }
  }, []);

  const executeSearch = useCallback(
    async (term: string, options: { recordHistory?: boolean } = {}) => {
      const actualTerm = term.trim();
      if (!actualTerm) {
        setResults([]);
        setSuggestions([]);
        setError(null);
        return;
      }

      searchAbortController.current?.abort();
      const controller = new AbortController();
      searchAbortController.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await api.searchVideos(actualTerm, controller.signal);
        const filtered = filterResultsByKeyword(response.results, actualTerm);
        setResults(filtered);

        const suggestionList = buildSuggestionList(filtered, actualTerm);
        setSuggestions(suggestionList);

        if (filtered.length === 0) {
          setError("没有找到相关内容");
        }

        if (options.recordHistory) {
          await updateHistory(actualTerm);
        }
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          return;
        }
        logger.info("Search failed:", err);
        setError("搜索失败，请稍后重试。");
      } finally {
        if (searchAbortController.current === controller) {
          setLoading(false);
        }
      }
    },
    [filterResultsByKeyword, buildSuggestionList, updateHistory]
  );

  useEffect(() => {
    if (skipNextAutoSearch.current) {
      skipNextAutoSearch.current = false;
      return;
    }

    if (!keyword.trim()) {
      setSuggestions([]);
      setResults([]);
      setError(null);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      executeSearch(keyword, { recordHistory: false });
    }, SEARCH_DEBOUNCE);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [keyword, executeSearch]);

  useEffect(() => {
    if (lastMessage && targetPage === "search") {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      skipNextAutoSearch.current = true;
      setKeyword(realMessage);
      executeSearch(realMessage, { recordHistory: true });
      clearMessage();
    }
  }, [lastMessage, targetPage, clearMessage, executeSearch]);

  useEffect(() => {
    if (deviceType !== "tv") {
      return;
    }

    const centerTarget = focusSection === "results" ? 0.0001 : 0.9;
    const resultTarget = focusSection === "results" ? 2.7999 : 1.8;

    Animated.timing(centerFlex, {
      toValue: centerTarget,
      duration: DeviceUtils.getAnimationDuration(320),
      useNativeDriver: false,
    }).start();

    Animated.timing(resultsFlex, {
      toValue: resultTarget,
      duration: DeviceUtils.getAnimationDuration(320),
      useNativeDriver: false,
    }).start();
  }, [focusSection, deviceType, centerFlex, resultsFlex]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      searchAbortController.current?.abort();
    };
  }, []);

  const handleQrPress = useCallback(() => {
    if (!remoteInputEnabled) {
      Alert.alert(
        "远程输入未启用",
        "请先在设置页面中启用远程输入功能",
        [
          { text: "取消", style: "cancel" },
          { text: "去设置", onPress: () => router.push("/settings") },
        ]
      );
      return;
    }
    showRemoteModal("search");
  }, [remoteInputEnabled, showRemoteModal, router]);

  const handleManualSearch = useCallback(
    (value?: string) => {
      const term = typeof value === "string" ? value : keyword;
      const trimmed = term.trim();
      if (!trimmed) {
        return;
      }

      skipNextAutoSearch.current = true;
      setKeyword(trimmed);
      executeSearch(trimmed, { recordHistory: true });

      if (deviceType !== "tv") {
        Keyboard.dismiss();
      }
    },
    [keyword, executeSearch, deviceType]
  );

  const handleKeyboardInput = useCallback((key: KeyboardKey) => {
    if (key.action === "clear") {
      setKeyword("");
      setResults([]);
      setSuggestions([]);
      setError(null);
      return;
    }

    if (key.action === "delete") {
      setKeyword((prev) => prev.slice(0, -1));
      return;
    }

    const value = key.value ?? key.label;
    setKeyword((prev) => `${prev}${value}`);
  }, []);

  const handleMiddleItemPress = useCallback(
    (value: string) => {
      if (!value) return;
      skipNextAutoSearch.current = true;
      setKeyword(value);
      executeSearch(value, { recordHistory: true });
    },
    [executeSearch]
  );

  const handleResultFocus = useCallback(
    (index: number) => {
      if (index >= 0) {
        setFocusSection("results");
      }
    },
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: SearchResult; index: number }) => (
      <VideoCard
        id={item.id.toString()}
        source={item.source}
        title={item.title}
        poster={item.poster}
        year={item.year}
        sourceName={item.source_name}
        api={api}
        onFocus={() => handleResultFocus(index)}
      />
    ),
    [handleResultFocus]
  );

  const trimmedKeyword = keyword.trim();

  const historyItems = useMemo(
    () => history.filter((item) => item && item.trim().length > 0),
    [history]
  );

  const filteredSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const suggestion of suggestions) {
      const trimmed = suggestion?.trim();
      if (!trimmed || trimmed === trimmedKeyword || seen.has(trimmed)) {
        continue;
      }
      if (historyItems.includes(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      list.push(trimmed);
    }
    return list;
  }, [suggestions, trimmedKeyword, historyItems]);

  const resultsColumns = useMemo(
    () => DeviceUtils.getSafeColumnCount(deviceType === "tv" ? 5 : responsiveConfig.columns),
    [deviceType, responsiveConfig.columns]
  );

  const renderKeyboardRow = useCallback(
    (row: KeyboardKey[], rowIndex: number) => (
      <View key={`keyboard-row-${rowIndex}`} style={dynamicStyles.tvKeyboardRow}>
        {row.map((key, keyIndex) => (
          <Pressable
            key={key.id}
            onFocus={() => {
              setFocusSection("keyboard");
              setIsInputFocused(false);
            }}
            style={({ pressed, focused }) => [
              dynamicStyles.tvKeyboardKey,
              { marginRight: keyIndex === row.length - 1 ? 0 : spacing / 2 },
              focused && dynamicStyles.tvKeyboardKeyFocused,
              pressed && dynamicStyles.tvKeyboardKeyPressed,
            ]}
            onPress={() => handleKeyboardInput(key)}
          >
            <ThemedText style={dynamicStyles.tvKeyboardKeyText}>{key.label}</ThemedText>
          </Pressable>
        ))}
      </View>
    ),
    [dynamicStyles.tvKeyboardKey, dynamicStyles.tvKeyboardKeyFocused, dynamicStyles.tvKeyboardKeyPressed, dynamicStyles.tvKeyboardKeyText, dynamicStyles.tvKeyboardRow, handleKeyboardInput, spacing]
  );

  const tvLayout = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      <View style={dynamicStyles.tvLayout}>
        <View style={dynamicStyles.tvLeftColumn}>
          <Pressable
            hasTVPreferredFocus
            onFocus={() => {
              setFocusSection("input");
              setIsInputFocused(true);
            }}
            onBlur={() => setIsInputFocused(false)}
            style={({ focused }) => [
              dynamicStyles.tvInputBox,
              (focused || isInputFocused) && dynamicStyles.tvInputBoxFocused,
            ]}
          >
            <ThemedText
              numberOfLines={1}
              style={trimmedKeyword ? dynamicStyles.tvInputText : dynamicStyles.tvInputPlaceholder}
            >
              {trimmedKeyword || "搜索电影、剧集..."}
            </ThemedText>
          </Pressable>

          <View style={dynamicStyles.tvInputActions}>
            <StyledButton style={dynamicStyles.tvActionButton} onPress={() => handleManualSearch()}>
              <View style={dynamicStyles.tvActionButtonContent}>
                <Search size={28} color="#ffffff" />
                <ThemedText style={dynamicStyles.tvActionButtonText}>搜索</ThemedText>
              </View>
            </StyledButton>
            <StyledButton style={dynamicStyles.tvActionButton} onPress={handleQrPress}>
              <View style={dynamicStyles.tvActionButtonContent}>
                <QrCode size={28} color="#ffffff" />
                <ThemedText style={dynamicStyles.tvActionButtonText}>远程</ThemedText>
              </View>
            </StyledButton>
          </View>

          <View style={dynamicStyles.tvKeyboardContainer}>
            {KEYBOARD_LAYOUT.map((row, rowIndex) => renderKeyboardRow(row, rowIndex))}
          </View>
        </View>

        <Animated.View style={[dynamicStyles.tvCenterColumn, { flex: centerFlex }]}>
          {trimmedKeyword ? (
            <Pressable
              style={({ focused }) => [
                dynamicStyles.tvActionItem,
                focused && dynamicStyles.tvActionItemFocused,
              ]}
              onFocus={() => setFocusSection("middle")}
              onPress={() => handleManualSearch(trimmedKeyword)}
            >
              <ThemedText style={dynamicStyles.tvActionItemText} numberOfLines={1}>
                {`直接搜索“${trimmedKeyword}”`}
              </ThemedText>
            </Pressable>
          ) : null}

          {historyItems.length > 0 && !trimmedKeyword && (
            <View style={dynamicStyles.tvSectionContainer}>
              <ThemedText style={dynamicStyles.tvSectionTitle}>搜索历史</ThemedText>
              {historyItems.map((item, index) => (
                <Pressable
                  key={`history-${item}-${index}`}
                  style={({ focused }) => [
                    dynamicStyles.tvMiddleItem,
                    focused && dynamicStyles.tvMiddleItemFocused,
                  ]}
                  onFocus={() => setFocusSection("middle")}
                  onPress={() => handleMiddleItemPress(item)}
                >
                  <ThemedText style={dynamicStyles.tvMiddleItemText} numberOfLines={1}>
                    {item}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}

          {(historyItems.length === 0 || trimmedKeyword) && (
            <View style={dynamicStyles.tvSectionContainer}>
              <ThemedText style={dynamicStyles.tvSectionTitle}>实时推荐</ThemedText>
              {filteredSuggestions.length === 0 ? (
                <ThemedText style={dynamicStyles.tvSectionEmpty}>继续输入以获取更多推荐</ThemedText>
              ) : (
                filteredSuggestions.map((item, index) => (
                  <Pressable
                    key={`suggestion-${item}-${index}`}
                    style={({ focused }) => [
                      dynamicStyles.tvMiddleItem,
                      focused && dynamicStyles.tvMiddleItemFocused,
                    ]}
                    onFocus={() => setFocusSection("middle")}
                    onPress={() => handleMiddleItemPress(item)}
                  >
                    <ThemedText style={dynamicStyles.tvMiddleItemText} numberOfLines={1}>
                      {item}
                    </ThemedText>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </Animated.View>

        <Animated.View style={[dynamicStyles.tvRightColumn, { flex: resultsFlex }]}>
          <View style={dynamicStyles.tvResultsHeader}>
            <ThemedText style={dynamicStyles.tvResultsTitle}>搜索结果</ThemedText>
            <ThemedText style={dynamicStyles.tvResultsSubtitle} numberOfLines={1}>
              {trimmedKeyword ? `关键词：${trimmedKeyword}` : "使用左侧键盘输入关键词"}
            </ThemedText>
          </View>

          {error && !loading && trimmedKeyword ? (
            <ThemedText style={dynamicStyles.tvErrorText}>{error}</ThemedText>
          ) : null}

          {loading ? (
            <View style={dynamicStyles.tvLoadingContainer}>
              <VideoLoadingAnimation showProgressBar={false} />
            </View>
          ) : (
            <CustomScrollView
              data={results}
              renderItem={renderItem}
              numColumns={resultsColumns}
              loading={false}
              error={null}
              emptyMessage={trimmedKeyword ? "暂无匹配内容" : "输入关键词开始搜索"}
            />
          )}
        </Animated.View>
      </View>
      <RemoteControlModal />
    </ThemedView>
  );

  const defaultLayout = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      <View style={dynamicStyles.searchContainer}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            dynamicStyles.inputContainer,
            { borderColor: isInputFocused ? Colors.dark.primary : "transparent" },
          ]}
          onPress={() => textInputRef.current?.focus()}
        >
          <TextInput
            ref={textInputRef}
            style={dynamicStyles.input}
            placeholder="搜索电影、剧集..."
            placeholderTextColor="#888"
            value={keyword}
            onChangeText={(text) => {
              setKeyword(text);
            }}
            onFocus={() => {
              setIsInputFocused(true);
              setFocusSection("input");
            }}
            onBlur={() => setIsInputFocused(false)}
            onSubmitEditing={() => handleManualSearch()}
            returnKeyType="search"
          />
        </TouchableOpacity>
        <StyledButton style={dynamicStyles.searchButton} onPress={() => handleManualSearch()}>
          <Search size={deviceType === "mobile" ? 20 : 24} color="white" />
        </StyledButton>
        {deviceType !== "mobile" && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={20} color="white" />
          </StyledButton>
        )}
      </View>

      {(historyItems.length > 0 || filteredSuggestions.length > 0) && (
        <View style={dynamicStyles.suggestionSection}>
          {historyItems.length > 0 && (
            <View style={dynamicStyles.suggestionGroup}>
              <ThemedText style={dynamicStyles.suggestionTitle}>搜索历史</ThemedText>
              <View style={dynamicStyles.suggestionList}>
                {historyItems.slice(0, 6).map((item, index) => (
                  <TouchableOpacity
                    key={`history-chip-${item}-${index}`}
                    style={dynamicStyles.suggestionChip}
                    onPress={() => handleMiddleItemPress(item)}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={dynamicStyles.suggestionChipText}>{item}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {filteredSuggestions.length > 0 && (
            <View style={dynamicStyles.suggestionGroup}>
              <ThemedText style={dynamicStyles.suggestionTitle}>实时推荐</ThemedText>
              <View style={dynamicStyles.suggestionList}>
                {filteredSuggestions.slice(0, 6).map((item, index) => (
                  <TouchableOpacity
                    key={`suggestion-chip-${item}-${index}`}
                    style={dynamicStyles.suggestionChip}
                    onPress={() => handleMiddleItemPress(item)}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={dynamicStyles.suggestionChipText}>{item}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <VideoLoadingAnimation showProgressBar={false} />
      ) : error ? (
        <View style={[commonStyles.center, { flex: 1 }]}>{/* fallback */}
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      ) : (
        <CustomScrollView
          data={results}
          renderItem={renderItem}
          loading={false}
          error={null}
          emptyMessage={keyword.trim() ? "暂无匹配内容" : "输入关键词开始搜索"}
        />
      )}
      <RemoteControlModal />
    </ThemedView>
  );

  if (deviceType === "tv") {
    return tvLayout;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {defaultLayout}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === "mobile";
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();
  const isTV = deviceType === "tv";

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: isTV ? 40 : 0,
    },
    searchContainer: {
      flexDirection: "row",
      paddingHorizontal: spacing,
      marginBottom: spacing,
      alignItems: "center",
      paddingTop: isMobile ? spacing / 2 : 0,
    },
    inputContainer: {
      flex: 1,
      height: isMobile ? minTouchTarget : 50,
      backgroundColor: "#2c2c2e",
      borderRadius: 8,
      marginRight: spacing / 2,
      borderWidth: 2,
      borderColor: "transparent",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      paddingHorizontal: spacing,
      color: "white",
      fontSize: isMobile ? 16 : 18,
    },
    searchButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      marginRight: deviceType !== "mobile" ? spacing / 2 : 0,
    },
    qrButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
    },
    errorText: {
      color: Colors.dark.primary,
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
    suggestionSection: {
      paddingHorizontal: spacing,
      marginBottom: spacing,
    },
    suggestionGroup: {
      marginBottom: spacing / 2,
    },
    suggestionTitle: {
      color: "#a2a5b4",
      fontSize: isMobile ? 14 : 16,
      marginBottom: spacing / 2,
      fontWeight: "600",
    },
    suggestionList: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    suggestionChip: {
      backgroundColor: "#2c2c2e",
      borderRadius: 999,
      paddingHorizontal: spacing,
      paddingVertical: spacing / 2,
      marginRight: spacing / 2,
      marginBottom: spacing / 4,
    },
    suggestionChipText: {
      color: "#ffffff",
      fontSize: isMobile ? 13 : 15,
    },
    tvLayout: {
      flex: 1,
      flexDirection: "row",
      paddingHorizontal: spacing,
      paddingBottom: spacing,
    },
    tvLeftColumn: {
      flex: 1.2,
      marginRight: spacing,
      maxWidth: 360,
    },
    tvCenterColumn: {
      flex: 0.9,
      backgroundColor: "#1b1d24",
      borderRadius: 18,
      padding: spacing,
      marginRight: spacing,
    },
    tvRightColumn: {
      flex: 1.8,
      backgroundColor: "#1b1d24",
      borderRadius: 18,
      padding: spacing,
    },
    tvInputBox: {
      backgroundColor: "#1f212a",
      borderRadius: 18,
      borderWidth: 2,
      borderColor: "transparent",
      paddingHorizontal: spacing,
      paddingVertical: spacing * 1.2,
    },
    tvInputBoxFocused: {
      borderColor: Colors.dark.primary,
      shadowColor: Colors.dark.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 12,
    },
    tvInputText: {
      color: "#ffffff",
      fontSize: 26,
      fontWeight: "600",
    },
    tvInputPlaceholder: {
      color: "#6c6f80",
      fontSize: 20,
    },
    tvInputActions: {
      flexDirection: "row",
      marginTop: spacing,
    },
    tvActionButton: {
      marginRight: spacing / 2,
    },
    tvActionButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing / 3,
    },
    tvActionButtonText: {
      color: "#ffffff",
      fontSize: 18,
      marginLeft: spacing / 3,
      fontWeight: "600",
    },
    tvKeyboardContainer: {
      marginTop: spacing,
    },
    tvKeyboardRow: {
      flexDirection: "row",
      marginBottom: spacing / 2,
    },
    tvKeyboardKey: {
      flex: 1,
      backgroundColor: "#262834",
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "transparent",
      minHeight: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    tvKeyboardKeyFocused: {
      borderColor: Colors.dark.primary,
      backgroundColor: "#2f3140",
    },
    tvKeyboardKeyPressed: {
      backgroundColor: "#36394f",
    },
    tvKeyboardKeyText: {
      color: "#ffffff",
      fontSize: 22,
      fontWeight: "600",
    },
    tvActionItem: {
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "transparent",
      paddingVertical: spacing * 0.9,
      paddingHorizontal: spacing,
      marginBottom: spacing,
    },
    tvActionItemFocused: {
      borderColor: Colors.dark.primary,
      backgroundColor: "#242736",
    },
    tvActionItemText: {
      color: "#ffffff",
      fontSize: 20,
      fontWeight: "600",
    },
    tvSectionContainer: {
      marginBottom: spacing * 0.5,
    },
    tvSectionTitle: {
      color: "#d0d3e0",
      fontSize: 18,
      fontWeight: "600",
      marginBottom: spacing / 2,
    },
    tvSectionEmpty: {
      color: "#7e8295",
      fontSize: 16,
    },
    tvMiddleItem: {
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "transparent",
      paddingVertical: spacing * 0.8,
      paddingHorizontal: spacing,
      marginBottom: spacing / 1.1,
    },
    tvMiddleItemFocused: {
      borderColor: Colors.dark.primary,
      backgroundColor: "#262a3a",
    },
    tvMiddleItemText: {
      color: "#ffffff",
      fontSize: 18,
    },
    tvResultsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing,
    },
    tvResultsTitle: {
      color: "#ffffff",
      fontSize: 22,
      fontWeight: "700",
    },
    tvResultsSubtitle: {
      color: "#8d91a4",
      fontSize: 16,
    },
    tvErrorText: {
      color: Colors.dark.primary,
      fontSize: 18,
      marginBottom: spacing,
    },
    tvLoadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });
};
