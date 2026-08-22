import React, { useState, useRef, useImperativeHandle, forwardRef, useMemo } from "react";
import { View, TextInput, StyleSheet, Animated, Platform, useColorScheme, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTVEventHandler } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { useButtonAnimation } from "@/hooks/useAnimation";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { CheckCircle2, AlertCircle, X } from "lucide-react-native";

interface LiveStreamSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onPress?: () => void;
}

export interface LiveStreamSectionRef {
  setInputValue: (value: string) => void;
}

export const LiveStreamSection = forwardRef<LiveStreamSectionRef, LiveStreamSectionProps>(
  ({ onChanged, onFocus, onBlur, onPress }, ref) => {
    const colorScheme = useColorScheme() === "light" ? "light" : "dark";
    const colors = Colors[colorScheme];
    const {
      m3uUrl,
      setM3uUrl,
      remoteInputEnabled,
      testM3uConnection,
      isTestingM3u,
      lastM3uTestResult,
    } = useSettingsStore();
    const { serverUrl } = useRemoteControlStore();
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isSectionFocused, setIsSectionFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const inputAnimationStyle = useButtonAnimation(isSectionFocused, 1.01);
    const deviceType = useResponsiveLayout().deviceType;

    const handleUrlChange = (url: string) => {
      setM3uUrl(url);
      onChanged();
    };

    const handleClear = () => {
      setM3uUrl("");
      onChanged();
    };

    useImperativeHandle(ref, () => ({
      setInputValue: (value: string) => {
        setM3uUrl(value);
        onChanged();
      },
    }));

    const handleSectionFocus = () => {
      setIsSectionFocused(true);
      onFocus?.();
    };

    const handleSectionBlur = () => {
      setIsSectionFocused(false);
      onBlur?.();
    };

    const handlePress = () => {
      inputRef.current?.focus();
      onPress?.();
    };

    const handleTVEvent = React.useCallback(
      (event: any) => {
        if (isSectionFocused && event.eventType === "select") {
          inputRef.current?.focus();
        }
      },
      [isSectionFocused]
    );

    useTVEventHandler(handleTVEvent);

    const [selection, setSelection] = useState<{ start: number; end: number }>({
      start: 0,
      end: 0,
    });
    const onSelectionChange = ({ nativeEvent: { selection } }: any) => {
      setSelection(selection);
    };

    const styles = useMemo(() => StyleSheet.create({
      titleContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
      },
      sectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginRight: 12,
      },
      subtitle: {
        fontSize: 12,
        color: colors.icon,
        fontStyle: "italic",
      },
      inputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      },
      inputContainer: {
        flex: 1,
        position: "relative",
      },
      input: {
        height: 50,
        borderWidth: 2,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingRight: m3uUrl ? 40 : 15,
        fontSize: 16,
        backgroundColor: colors.border,
        color: colors.text,
        borderColor: "transparent",
      },
      inputFocused: {
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 5,
      },
      clearButton: {
        position: "absolute",
        right: 12,
        top: 15,
        zIndex: 10,
      },
      testButton: {
        height: 50,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
        minWidth: 90,
      },
      testButtonDisabled: {
        opacity: 0.6,
      },
      testButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
      },
      statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        paddingVertical: 4,
        gap: 6,
      },
      statusTextSuccess: {
        fontSize: 13,
        color: "#4ade80",
      },
      statusTextError: {
        fontSize: 13,
        color: "#f87171",
      },
    }), [colors, m3uUrl]);

    return (
      <SettingsSection focusable onFocus={handleSectionFocus} onBlur={handleSectionBlur}
        onPress={Platform.isTV || deviceType !== "tv" ? undefined : handlePress}
      >
        <View style={{ marginBottom: 12 }}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.sectionTitle}>直播源地址</ThemedText>
            {remoteInputEnabled && serverUrl && (
              <ThemedText style={styles.subtitle}>用手机访问 {serverUrl}，可远程输入</ThemedText>
            )}
          </View>
          <View style={styles.inputRow}>
            <Animated.View style={[inputAnimationStyle, styles.inputContainer]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, isInputFocused && styles.inputFocused]}
                value={m3uUrl}
                onChangeText={handleUrlChange}
                placeholder="输入 M3U 直播源地址 (如: http://example.com/live.m3u)"
                placeholderTextColor={colors.icon}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => {
                  setIsInputFocused(true);
                  const end = m3uUrl.length;
                  setSelection({ start: end, end: end });
                  setTimeout(() => {
                    inputRef.current?.setNativeProps({ selection: { start: end, end: end } });
                  }, 0);
                }}
                selection={selection}
                onSelectionChange={onSelectionChange}
                onBlur={() => setIsInputFocused(false)}
              />
              {Boolean(m3uUrl) && (
                <TouchableOpacity style={styles.clearButton} onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={18} color={colors.icon} />
                </TouchableOpacity>
              )}
            </Animated.View>

            <TouchableOpacity
              style={[styles.testButton, (!m3uUrl || isTestingM3u) && styles.testButtonDisabled]}
              onPress={() => testM3uConnection()}
              disabled={!m3uUrl || isTestingM3u}
            >
              {isTestingM3u ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.testButtonText}>探测源</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {lastM3uTestResult && (
            <View style={styles.statusBadge}>
              {lastM3uTestResult.success ? (
                <>
                  <CheckCircle2 size={16} color="#4ade80" />
                  <ThemedText style={styles.statusTextSuccess}>
                    解析成功 (共 {lastM3uTestResult.channelCount} 个频道
                    {lastM3uTestResult.sampleChannels?.length
                      ? ` · 示例: ${lastM3uTestResult.sampleChannels.join(", ")}`
                      : ""}
                    )
                  </ThemedText>
                </>
              ) : (
                <>
                  <AlertCircle size={16} color="#f87171" />
                  <ThemedText style={styles.statusTextError}>
                    {lastM3uTestResult.error || "探测失败"}
                  </ThemedText>
                </>
              )}
            </View>
          )}
        </View>
      </SettingsSection>
    );
  }
);

LiveStreamSection.displayName = "LiveStreamSection";
