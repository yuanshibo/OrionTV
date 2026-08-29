import React, { useState, useRef, useImperativeHandle, forwardRef, useMemo } from "react";
import { View, TextInput, StyleSheet, useColorScheme, TouchableOpacity, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { StyledButton } from "@/components/StyledButton";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { CheckCircle2, AlertCircle, X } from "lucide-react-native";
import Toast from "react-native-toast-message";

export interface SettingsInputSectionRef {
  setInputValue: (value: string) => void;
}

export interface SettingsInputSectionProps {
  title: string;
  value: string;
  onChangeValue: (value: string) => void;
  placeholder?: string;
  buttonText: string;
  isLoading?: boolean;
  onTest: () => void;
  emptyToastMessage?: string;
  testResult?: {
    success: boolean;
    error?: string;
  } | null;
  renderSuccessMessage?: () => string;
  fallbackErrorMessage?: string;
  hideDescription?: boolean;
  onChanged?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const SettingsInputSection = forwardRef<SettingsInputSectionRef, SettingsInputSectionProps>(
  (
    {
      title,
      value,
      onChangeValue,
      placeholder,
      buttonText,
      isLoading = false,
      onTest,
      emptyToastMessage,
      testResult,
      renderSuccessMessage,
      fallbackErrorMessage = "操作失败",
      hideDescription = false,
      onChanged,
      onFocus,
      onBlur,
    },
    ref
  ) => {
    const colorScheme = useColorScheme() === "light" ? "light" : "dark";
    const colors = Colors[colorScheme];
    const { remoteInputEnabled } = useSettingsStore();
    const { serverUrl } = useRemoteControlStore();
    const [isInputFocused, setIsInputFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const { deviceType } = useResponsiveLayout();

    const handleTextChange = (text: string) => {
      onChangeValue(text);
      onChanged?.();
    };

    const handleClear = () => {
      onChangeValue("");
      onChanged?.();
    };

    useImperativeHandle(ref, () => ({
      setInputValue: (val: string) => {
        onChangeValue(val);
        onChanged?.();
      },
    }));

    const handleTestPress = () => {
      if (!value.trim()) {
        if (emptyToastMessage) {
          Toast.show({ type: "error", text1: emptyToastMessage });
        }
        return;
      }
      onTest();
    };

    const styles = useMemo(
      () =>
        StyleSheet.create({
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
            paddingRight: value ? 40 : 15,
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
        }),
      [colors, value]
    );

    return (
      <SettingsSection focusable={false}>
        <View style={{ marginBottom: 12 }}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
            {!hideDescription && remoteInputEnabled && serverUrl && (
              <ThemedText style={styles.subtitle}>用手机访问 {serverUrl}，可远程输入</ThemedText>
            )}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={[styles.input, isInputFocused && styles.inputFocused]}
                value={value}
                onChangeText={handleTextChange}
                placeholder={placeholder}
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
              {Boolean(value) && (
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
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{buttonText}</ThemedText>
              )}
            </StyledButton>
          </View>

          {testResult && (
            <View style={styles.statusBadge}>
              {testResult.success ? (
                <>
                  <CheckCircle2 size={16} color="#4ade80" />
                  <ThemedText style={styles.statusTextSuccess}>
                    {renderSuccessMessage ? renderSuccessMessage() : "成功"}
                  </ThemedText>
                </>
              ) : (
                <>
                  <AlertCircle size={16} color="#f87171" />
                  <ThemedText style={styles.statusTextError}>
                    {testResult.error || fallbackErrorMessage}
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

SettingsInputSection.displayName = "SettingsInputSection";
