import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import Logger from "@/utils/Logger";
import { SearchHistoryManager } from "@/services/storage";

const logger = Logger.withTag("SearchScreen");

const TV_KEYBOARD_LAYOUT: string[][] = [
  ["A", "B", "C", "D", "E", "F", "G"],
  ["H", "I", "J", "K", "L", "M", "N"],
  ["O", "P", "Q", "R", "S", "T", "U"],
  ["V", "W", "X", "Y", "Z", "删除", "清空"],
  ["0", "1", "2", "3", "4", "5", "6"],
  ["7", "8", "9", "空格", "-", ".", "搜索"],
];

const FIRST_PINYIN_CHARS = "阿八嚓哒妸发旮哈讥咔垃痳拏噢妑七呥仨他哇昔压匝";
const FIRST_PINYIN_LETTERS = "ABCDEFGHJKLMNOPQRSTWXYZ";

const normalizeText = (text: string) => text.replace(/\s+/g, "").toUpperCase();

const getPinyinInitial = (char: string): string => {
  if (!char) return "";

  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) return char.toUpperCase();
  if (code >= 97 && code <= 122) return char.toUpperCase();
  if (/^[0-9]$/.test(char)) return char;

  if (/^[\u4E00-\u9FFF]$/.test(char)) {
    for (let i = FIRST_PINYIN_CHARS.length - 1; i >= 0; i--) {
      if (char.localeCompare(FIRST_PINYIN_CHARS[i], "zh-Hans-CN") >= 0) {
        return FIRST_PINYIN_LETTERS[i];
      }
    }
  }

  return char.toUpperCase();
};

const getPinyinInitials = (text: string) =>
  Array.from(text)
    .map(getPinyinInitial)
    .join("");

const createTVStyles = (spacing: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing * 1.5,
      paddingVertical: spacing * 1.5,
      paddingTop: spacing * 2,
    },
    content: {
      flex: 1,
      flexDirection: "row",
    },
    keyboardColumn: {
      flex: 1.1,
      marginRight: spacing,
      padding: spacing,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    keyboardHeader: {
      marginBottom: spacing,
    },
    keywordInputRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing * 0.5,
    },
    keywordInputContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
      backgroundColor: "rgba(0,0,0,0.3)",
      paddingHorizontal: spacing,
    },
    keywordInputContainerFocused: {
      borderColor: Colors.dark.primary,
      backgroundColor: "rgba(13,13,13,0.6)",
    },
    keywordInput: {
      flex: 1,
      color: "white",
      fontSize: 26,
      fontWeight: "600",
      letterSpacing: 2,
      paddingVertical: 0,
    },
    inlineSearchButton: {
      marginLeft: spacing / 2,
      borderRadius: 12,
      height: 56,
      minWidth: 96,
    },
    inlineSearchButtonText: {
      fontSize: 18,
      fontWeight: "600",
    },
    tipText: {
      color: "rgba(255,255,255,0.75)",
      fontSize: 18,
      marginBottom: spacing / 2,
    },
    keyboardGrid: {
      marginTop: spacing * 0.75,
    },
    keyboardRow: {
      flexDirection: "row",
      marginBottom: spacing / 2,
    },
    keyboardButton: {
      flex: 1,
      height: 56,
      marginRight: spacing / 2,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    keyboardButtonLast: {
      marginRight: 0,
    },
    keyboardButtonText: {
      fontSize: 20,
      fontWeight: "600",
    },
    keyboardActions: {
      marginTop: spacing,
      flexDirection: "row",
    },
    remoteButton: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      backgroundColor: "rgba(255,255,255,0.05)",
      height: 56,
    },
    remoteButtonText: {
      fontSize: 18,
      color: "white",
    },
    middleColumn: {
      flex: 1.1,
      marginRight: spacing,
      padding: spacing,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    middleColumnCollapsed: {
      flex: 0.75,
    },
    section: {
      marginBottom: spacing,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing / 2,
    },
    sectionTitle: {
      color: "white",
      fontSize: 20,
      fontWeight: "600",
    },
    clearButton: {
      paddingHorizontal: spacing,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    clearButtonText: {
      fontSize: 16,
      color: "rgba(255,255,255,0.9)",
    },
    chipsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    chipButton: {
      marginRight: spacing / 2,
      marginBottom: spacing / 2,
      borderRadius: 999,
      paddingHorizontal: spacing,
      paddingVertical: spacing * 0.6,
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    chipButtonText: {
      fontSize: 18,
      color: "white",
    },
    placeholderText: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 16,
    },
    suggestionSection: {
      flex: 1,
    },
    resultsColumn: {
      flex: 2.4,
      padding: spacing,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    resultsColumnExpanded: {
      flex: 2.9,
    },
    resultsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing / 2,
    },
    resultsTitle: {
      color: "white",
      fontSize: 22,
      fontWeight: "700",
    },
    resultsKeyword: {
      color: "rgba(255,255,255,0.7)",
      fontSize: 18,
    },
    resultsWrapper: {
      flex: 1,
    },
  });

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestionPool, setSuggestionPool] = useState<string[]>([]);
  const [activeColumn, setActiveColumn] = useState<"keyboard" | "middle" | "results">("keyboard");
  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();
  const skipRealtimeSearchRef = useRef(false);
  const latestSearchIdRef = useRef(0);

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;
  const tvStyles = useMemo(() => createTVStyles(spacing), [spacing]);
  const normalizedKeyword = useMemo(() => normalizeText(keyword), [keyword]);
  const isResultsFocused = activeColumn === "results";

  const matchesKeyword = useCallback((value: string, query: string) => {
    if (!value) return false;
    if (!query) return true;

    const normalizedValue = normalizeText(value);
    if (normalizedValue.includes(query)) {
      return true;
    }

    const initials = getPinyinInitials(value);
    return initials.includes(query);
  }, []);

  const filteredHistory = useMemo(() => {
    if (!searchHistory.length) {
      return [];
    }

    if (!normalizedKeyword) {
      return searchHistory.slice(0, 12);
    }

    return searchHistory.filter(item => matchesKeyword(item, normalizedKeyword)).slice(0, 12);
  }, [searchHistory, normalizedKeyword, matchesKeyword]);

  const filteredSuggestions = useMemo(() => {
    if (!suggestionPool.length) {
      return [];
    }

    if (!normalizedKeyword) {
      return suggestionPool.slice(0, 12);
    }

    return suggestionPool.filter(item => matchesKeyword(item, normalizedKeyword)).slice(0, 12);
  }, [suggestionPool, normalizedKeyword, matchesKeyword]);

  const refreshHistory = useCallback(async () => {
    try {
      const history = await SearchHistoryManager.get();
      setSearchHistory(history);
    } catch (err) {
      logger.info("Failed to load search history:", err);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const runSearch = useCallback(
    async (term: string, options: { saveToHistory?: boolean } = {}) => {
      const actualTerm = term.trim();
      if (!actualTerm) {
        latestSearchIdRef.current += 1;
        setResults([]);
        setError(null);
        setLoading(false);
        setSuggestionPool([]);
        return;
      }

      const requestId = ++latestSearchIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const response = await api.searchVideos(actualTerm);
        if (latestSearchIdRef.current !== requestId) {
          return;
        }

        setResults(response.results);
        if (response.results.length === 0) {
          setError("没有找到相关内容");
        } else {
          setError(null);
        }

        const uniqueSuggestions = Array.from(
          new Set(
            response.results
              .map(item => item.title)
              .filter((title): title is string => !!title)
          )
        ).slice(0, 12);

        if (uniqueSuggestions.length > 0) {
          setSuggestionPool(uniqueSuggestions);
        } else {
          setSuggestionPool([]);
        }

        if (options.saveToHistory) {
          await SearchHistoryManager.add(actualTerm);
          refreshHistory();
        }
      } catch (err) {
        logger.info("Search failed:", err);
        if (latestSearchIdRef.current === requestId) {
          setError("搜索失败，请稍后重试。");
          setSuggestionPool([]);
        }
      } finally {
        if (latestSearchIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [refreshHistory]
  );

  useEffect(() => {
    if (lastMessage && targetPage === "search") {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      skipRealtimeSearchRef.current = true;
      setKeyword(realMessage);
      runSearch(realMessage, { saveToHistory: true });
      clearMessage();
    }
  }, [lastMessage, targetPage, runSearch, clearMessage]);

  useEffect(() => {
    if (deviceType !== "tv") {
      return;
    }

    if (skipRealtimeSearchRef.current) {
      skipRealtimeSearchRef.current = false;
      return;
    }

    if (!keyword.trim()) {
      runSearch("", { saveToHistory: false });
      return;
    }

    const timer = setTimeout(() => {
      runSearch(keyword, { saveToHistory: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [deviceType, keyword, runSearch]);

  const handleQrPress = useCallback(() => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal("search");
  }, [remoteInputEnabled, router, showRemoteModal]);

  const handleHistorySelect = useCallback(
    (value: string) => {
      skipRealtimeSearchRef.current = true;
      setKeyword(value);
      runSearch(value, { saveToHistory: true });
    },
    [runSearch]
  );

  const handleSuggestionSelect = useCallback(
    (value: string) => {
      skipRealtimeSearchRef.current = true;
      setKeyword(value);
      runSearch(value, { saveToHistory: true });
    },
    [runSearch]
  );

  const handleClearHistory = useCallback(async () => {
    try {
      await SearchHistoryManager.clear();
      await refreshHistory();
    } catch (err) {
      logger.info("Failed to clear search history:", err);
    }
  }, [refreshHistory]);

  const handleKeyboardInput = useCallback(
    (keyLabel: string) => {
      switch (keyLabel) {
        case "删除":
          setKeyword(prev => prev.slice(0, -1));
          return;
        case "清空":
          skipRealtimeSearchRef.current = true;
          setKeyword("");
          runSearch("", { saveToHistory: false });
          return;
        case "空格":
          setKeyword(prev => `${prev} `);
          return;
        case "搜索":
          if (keyword.trim()) {
            skipRealtimeSearchRef.current = true;
            runSearch(keyword, { saveToHistory: true });
          }
          return;
        default:
          setKeyword(prev => `${prev}${/[A-Za-z]/.test(keyLabel) ? keyLabel.toUpperCase() : keyLabel}`);
      }
    },
    [keyword, runSearch]
  );

  const onSearchPress = useCallback(() => {
    skipRealtimeSearchRef.current = true;
    Keyboard.dismiss();
    runSearch(keyword, { saveToHistory: true });
  }, [keyword, runSearch]);

  const renderItem = ({ item }: { item: SearchResult; index: number }) => (
    <VideoCard
      id={item.id.toString()}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      sourceName={item.source_name}
      api={api}
      onFocus={() => setActiveColumn("results")}
    />
  );

  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderNonTVContent = () => (
    <>
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
            placeholder="搜索电影、剧集..."
            placeholderTextColor="#888"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={onSearchPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            returnKeyType="search"
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

      {loading ? (
        <VideoLoadingAnimation showProgressBar={false} />
      ) : error ? (
        <View style={[commonStyles.center, { flex: 1 }]}> 
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      ) : (
        <CustomScrollView
          data={results}
          renderItem={renderItem}
          loading={loading}
          error={error}
          emptyMessage="输入关键词开始搜索"
        />
      )}
      <RemoteControlModal />
    </>
  );

  const renderTVContent = () => (
    <>
      <View style={tvStyles.content}>
        <View style={tvStyles.keyboardColumn}>
          <View style={tvStyles.keyboardHeader}>
            <ThemedText style={tvStyles.tipText}>支持全拼首字母等中英输入</ThemedText>
            <View style={tvStyles.keywordInputRow}>
              <View
                style={[
                  tvStyles.keywordInputContainer,
                  isInputFocused && tvStyles.keywordInputContainerFocused,
                ]}
              >
                <TextInput
                  ref={textInputRef}
                  style={tvStyles.keywordInput}
                  value={keyword}
                  placeholder="输入片名或首字母"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  onChangeText={setKeyword}
                  onFocus={() => {
                    setIsInputFocused(true);
                    setActiveColumn("keyboard");
                  }}
                  onBlur={() => setIsInputFocused(false)}
                  onSubmitEditing={onSearchPress}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                  showSoftInputOnFocus={false}
                  blurOnSubmit={false}
                />
              </View>
              <StyledButton
                text="搜索"
                onPress={onSearchPress}
                style={tvStyles.inlineSearchButton}
                textStyle={tvStyles.inlineSearchButtonText}
                onFocus={() => setActiveColumn("keyboard")}
              />
            </View>
          </View>

          <View style={tvStyles.keyboardGrid}>
            {TV_KEYBOARD_LAYOUT.map((row, rowIndex) => (
              <View key={`keyboard-row-${rowIndex}`} style={tvStyles.keyboardRow}>
                {row.map((keyLabel, keyIndex) => (
                  <StyledButton
                    key={`${keyLabel}-${keyIndex}`}
                    text={keyLabel}
                    onPress={() => handleKeyboardInput(keyLabel)}
                    onFocus={() => setActiveColumn("keyboard")}
                    style={[
                      tvStyles.keyboardButton,
                      keyIndex === row.length - 1 && tvStyles.keyboardButtonLast,
                    ]}
                    textStyle={tvStyles.keyboardButtonText}
                    hasTVPreferredFocus={rowIndex === 0 && keyIndex === 0}
                  />
                ))}
              </View>
            ))}
          </View>

          <View style={tvStyles.keyboardActions}>
            <StyledButton
              text="远程输入"
              onPress={handleQrPress}
              variant="ghost"
              style={tvStyles.remoteButton}
              textStyle={tvStyles.remoteButtonText}
              onFocus={() => setActiveColumn("keyboard")}
            />
          </View>
        </View>

        <View style={[tvStyles.middleColumn, isResultsFocused && tvStyles.middleColumnCollapsed]}>
          <View style={tvStyles.section}>
            <View style={tvStyles.sectionHeader}>
              <ThemedText style={tvStyles.sectionTitle}>搜索历史</ThemedText>
              {searchHistory.length > 0 && (
                <StyledButton
                  text="清除"
                  variant="ghost"
                  onPress={handleClearHistory}
                  style={tvStyles.clearButton}
                  textStyle={tvStyles.clearButtonText}
                  onFocus={() => setActiveColumn("middle")}
                />
              )}
            </View>
            <View style={tvStyles.chipsContainer}>
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item, index) => (
                  <StyledButton
                    key={`history-${item}-${index}`}
                    text={item}
                    variant="ghost"
                    onPress={() => handleHistorySelect(item)}
                    onFocus={() => setActiveColumn("middle")}
                    style={tvStyles.chipButton}
                    textStyle={tvStyles.chipButtonText}
                  />
                ))
              ) : (
                <ThemedText style={tvStyles.placeholderText}>暂无搜索历史</ThemedText>
              )}
            </View>
          </View>

          <View style={[tvStyles.section, tvStyles.suggestionSection]}>
            <View style={tvStyles.sectionHeader}>
              <ThemedText style={tvStyles.sectionTitle}>搜索建议</ThemedText>
            </View>
            <View style={tvStyles.chipsContainer}>
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((item, index) => (
                  <StyledButton
                    key={`suggestion-${item}-${index}`}
                    text={item}
                    variant="ghost"
                    onPress={() => handleSuggestionSelect(item)}
                    onFocus={() => setActiveColumn("middle")}
                    style={tvStyles.chipButton}
                    textStyle={tvStyles.chipButtonText}
                  />
                ))
              ) : (
                <ThemedText style={tvStyles.placeholderText}>暂无推荐</ThemedText>
              )}
            </View>
          </View>
        </View>

        <View
          style={[
            tvStyles.resultsColumn,
            isResultsFocused && tvStyles.resultsColumnExpanded,
          ]}
        >
          <View style={tvStyles.resultsHeader}>
            <ThemedText style={tvStyles.resultsTitle}>搜索结果</ThemedText>
            {keyword ? <ThemedText style={tvStyles.resultsKeyword}>{keyword}</ThemedText> : null}
          </View>
          <View style={tvStyles.resultsWrapper}>
            {loading ? (
              <VideoLoadingAnimation showProgressBar={false} />
            ) : (
              <CustomScrollView
                data={results}
                renderItem={renderItem}
                loading={false}
                error={error}
                emptyMessage={keyword.trim() ? error ?? "没有找到相关内容" : "输入关键词开始搜索"}
                numColumns={3}
              />
            )}
          </View>
        </View>
      </View>
      <RemoteControlModal />
    </>
  );

  const nonTVContent = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderNonTVContent()}
    </ThemedView>
  );

  const tvContent = (
    <ThemedView style={[commonStyles.container, tvStyles.container]}>
      {renderTVContent()}
    </ThemedView>
  );

  if (deviceType === "tv") {
    return tvContent;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {nonTVContent}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === "mobile";
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === "tv" ? 50 : 0,
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
      borderRadius: isMobile ? 8 : 8,
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
      borderRadius: isMobile ? 8 : 8,
      marginRight: deviceType !== "mobile" ? spacing / 2 : 0,
    },
    qrButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
    },
    errorText: {
      color: "red",
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
  });
};
