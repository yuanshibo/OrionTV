import React, { useState, useRef, useImperativeHandle, forwardRef, useMemo } from "react";
import { View, TextInput, StyleSheet, useColorScheme, TouchableOpacity, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { StyledButton } from "@/components/StyledButton";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { CheckCircle2, AlertCircle, X } from "lucide-react-native";
import Toast from "react-native-toast-message";

interface LiveStreamSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface LiveStreamSectionRef {
  setInputValue: (value: string) => void;
}

export const LiveStreamSection = forwardRef<LiveStreamSectionRef, LiveStreamSectionProps>(
  ({ onChanged, onFocus, onBlur }, ref) => {
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
    const inputRef = useRef<TextInput>(null);
    const { deviceType } = useResponsiveLayout();

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

    const handleTestPress = () => {
      if (!m3uUrl.trim()) {
        Toast.show({ type: "error", text1: "请输入 M3U 直播源地址" });
        return;
      }
      testM3uConnection();
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
        gap: 12,
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
        minWidth: 100,
        height: 50,
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
      <SettingsSection focusable={false}>
        <View style={{ marginBottom: 12 }}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.sectionTitle}>直播源地址</ThemedText>
            {remoteInputEnabled && serverUrl && (
              <ThemedText style={styles.subtitle}>用手机访问 {serverUrl}，可远程输入</ThemedText>
            )}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={[styles.input, isInputFocused && styles.inputFocused]}
                value={m3uUrl}
                onChangeText={handleUrlChange}
                placeholder="输入 M3U 直播源地址 (如: http://example.com/live.m3u)"
                placeholderTextColor={colors.icon}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                multiline={false}
                numberOfLines={1}
                blurOnSubmit={true}
                returnKeyType="done"
                onFocus={() => {
                  setIsInputFocused(true);
                  onFocus?.();
                }}
                onBlur={() => {
                  setIsInputFocused(false);
                  onBlur?.();
                }}
              />
              {Boolean(m3uUrl) && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClear}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  focusable={deviceType !== "tv"}
                >
                  <X size={18} color={colors.icon} />
                </TouchableOpacity>
              )}
            </View>

            <StyledButton
              style={styles.testButton}
              variant="primary"
              onPress={handleTestPress}
              disabled={isTestingM3u}
            >
              {isTestingM3u ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>探测源</ThemedText>
              )}
            </StyledButton>
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
