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

interface APIConfigSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  hideDescription?: boolean;
}

export interface APIConfigSectionRef {
  setInputValue: (value: string) => void;
}

export const APIConfigSection = forwardRef<APIConfigSectionRef, APIConfigSectionProps>(
  ({ onChanged, onFocus, onBlur, hideDescription = false }, ref) => {
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
    const inputRef = useRef<TextInput>(null);
    const { deviceType } = useResponsiveLayout();

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

    const handleTestPress = () => {
      if (!apiBaseUrl.trim()) {
        Toast.show({ type: "error", text1: "请输入 API 服务器地址" });
        return;
      }
      testApiConnection();
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
    }), [colors, apiBaseUrl]);

    return (
      <SettingsSection focusable={false}>
        <View style={{ marginBottom: 12 }}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.sectionTitle}>API 地址</ThemedText>
            {!hideDescription && remoteInputEnabled && serverUrl && (
              <ThemedText style={styles.subtitle}>用手机访问 {serverUrl}，可远程输入</ThemedText>
            )}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={[styles.input, isInputFocused && styles.inputFocused]}
                value={apiBaseUrl}
                onChangeText={handleUrlChange}
                placeholder="输入服务器地址 (如: http://192.168.1.100:8080)"
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
              {Boolean(apiBaseUrl) && (
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
              disabled={isTestingApi}
            >
              {isTestingApi ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>测试连接</ThemedText>
              )}
            </StyledButton>
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
