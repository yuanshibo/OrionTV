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

interface APIConfigSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onPress?: () => void;
  hideDescription?: boolean;
}

export interface APIConfigSectionRef {
  setInputValue: (value: string) => void;
}

export const APIConfigSection = forwardRef<APIConfigSectionRef, APIConfigSectionProps>(
  ({ onChanged, onFocus, onBlur, onPress, hideDescription = false }, ref) => {
    const colorScheme = useColorScheme() === "light" ? "light" : "dark";
    const colors = Colors[colorScheme];
    const {
      apiBaseUrl,
      setApiBaseUrl,
      remoteInputEnabled,
      testApiConnection,
      isTestingApi,
      lastApiTestResult,
    } = useSettingsStore();
    const { serverUrl } = useRemoteControlStore();
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isSectionFocused, setIsSectionFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const inputAnimationStyle = useButtonAnimation(isSectionFocused, 1.01);
    const deviceType = useResponsiveLayout().deviceType;

    const handleUrlChange = (url: string) => {
      setApiBaseUrl(url);
      onChanged();
    };

    const handleClear = () => {
      setApiBaseUrl("");
      onChanged();
    };

    useImperativeHandle(ref, () => ({
      setInputValue: (value: string) => {
        setApiBaseUrl(value);
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

    const handleTVEvent = React.useCallback(
      (event: any) => {
        if (isSectionFocused && event.eventType === "select") {
          inputRef.current?.focus();
        }
      },
      [isSectionFocused]
    );

    const handlePress = () => {
      inputRef.current?.focus();
      onPress?.();
    };

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
        paddingRight: apiBaseUrl ? 40 : 15,
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
    }), [colors, apiBaseUrl]);

    return (
      <SettingsSection focusable onFocus={handleSectionFocus} onBlur={handleSectionBlur}
        {...Platform.isTV || deviceType !== "tv" ? undefined : { onPress: handlePress }}
      >
        <View style={{ marginBottom: 12 }}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.sectionTitle}>API 地址</ThemedText>
            {!hideDescription && remoteInputEnabled && serverUrl && (
              <ThemedText style={styles.subtitle}>用手机访问 {serverUrl}，可远程输入</ThemedText>
            )}
          </View>
          <View style={styles.inputRow}>
            <Animated.View style={[inputAnimationStyle, styles.inputContainer]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, isInputFocused && styles.inputFocused]}
                value={apiBaseUrl}
                onChangeText={handleUrlChange}
                placeholder="输入服务器地址 (如: http://192.168.1.100:8080)"
                placeholderTextColor={colors.icon}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => {
                  setIsInputFocused(true);
                  const end = apiBaseUrl.length;
                  setSelection({ start: end, end: end });
                  setTimeout(() => {
                    inputRef.current?.setNativeProps({ selection: { start: end, end: end } });
                  }, 0);
                }}
                selection={selection}
                onSelectionChange={onSelectionChange}
                onBlur={() => setIsInputFocused(false)}
              />
              {Boolean(apiBaseUrl) && (
                <TouchableOpacity style={styles.clearButton} onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={18} color={colors.icon} />
                </TouchableOpacity>
              )}
            </Animated.View>

            <TouchableOpacity
              style={[styles.testButton, (!apiBaseUrl || isTestingApi) && styles.testButtonDisabled]}
              onPress={() => testApiConnection()}
              disabled={!apiBaseUrl || isTestingApi}
            >
              {isTestingApi ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.testButtonText}>测试连接</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {lastApiTestResult && (
            <View style={styles.statusBadge}>
              {lastApiTestResult.success ? (
                <>
                  <CheckCircle2 size={16} color="#4ade80" />
                  <ThemedText style={styles.statusTextSuccess}>
                    连通正常 ({lastApiTestResult.siteName} · 存储: {lastApiTestResult.storageType} · 延迟: {lastApiTestResult.latency}ms)
                  </ThemedText>
                </>
              ) : (
                <>
                  <AlertCircle size={16} color="#f87171" />
                  <ThemedText style={styles.statusTextError}>
                    {lastApiTestResult.error || "连接失败"}
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

APIConfigSection.displayName = "APIConfigSection";
