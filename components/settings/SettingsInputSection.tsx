import React, { useState, useRef, useImperativeHandle, forwardRef, useMemo } from "react";
import { View, TextInput, StyleSheet, useColorScheme, TouchableOpacity, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
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
  icon?: React.ReactNode;
  description?: string;
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
      icon,
      description,
      onChanged,
      onFocus,
      onBlur,
    },
    ref
  ) => {
    const colorScheme = useColorScheme() === "light" ? "light" : "dark";
    const colors = Colors[colorScheme];
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
          headerRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: description ? 6 : 12,
          },
          titleContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          },
          iconBadge: {
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
            alignItems: "center",
            justifyContent: "center",
          },
          sectionTitle: {
            fontSize: deviceType === "tv" ? 18 : 16,
            fontWeight: "bold",
            color: colors.text,
          },
          description: {
            fontSize: 13,
            color: colors.icon,
            marginBottom: 12,
            lineHeight: 18,
          },
          inputRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          },
          inputContainer: {
            flex: 1,
            position: "relative",
          },
          input: {
            height: deviceType === "tv" ? 52 : 48,
            borderWidth: 1.5,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingRight: value ? 44 : 16,
            fontSize: deviceType === "tv" ? 16 : 15,
            backgroundColor: colorScheme === "dark" ? "rgba(0, 0, 0, 0.35)" : "#f3f4f6",
            color: colors.text,
            borderColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
          },
          inputFocused: {
            borderColor: colors.primary,
            backgroundColor: colorScheme === "dark" ? "rgba(0, 0, 0, 0.55)" : "#ffffff",
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 8,
            elevation: 4,
          },
          clearButton: {
            position: "absolute",
            right: 12,
            top: deviceType === "tv" ? 16 : 14,
            zIndex: 10,
            padding: 2,
          },
          testButton: {
            minWidth: deviceType === "tv" ? 110 : 96,
            height: deviceType === "tv" ? 52 : 48,
            borderRadius: 10,
          },
          statusBadge: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: 10,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 8,
            gap: 8,
            alignSelf: "flex-start",
          },
          statusSuccessBadge: {
            backgroundColor: "rgba(74, 222, 128, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(74, 222, 128, 0.3)",
          },
          statusErrorBadge: {
            backgroundColor: "rgba(248, 113, 113, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(248, 113, 113, 0.3)",
          },
          statusTextSuccess: {
            fontSize: 13,
            color: "#4ade80",
            fontWeight: "500",
          },
          statusTextError: {
            fontSize: 13,
            color: "#f87171",
            fontWeight: "500",
          },
        }),
      [colors, colorScheme, description, deviceType, value]
    );

    return (
      <SettingsSection focusable={false}>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              {icon && <View style={styles.iconBadge}>{icon}</View>}
              <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
            </View>
          </View>

          {description && (
            <ThemedText style={styles.description}>{description}</ThemedText>
          )}

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
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
            <View
              style={[
                styles.statusBadge,
                testResult.success ? styles.statusSuccessBadge : styles.statusErrorBadge,
              ]}
            >
              {testResult.success ? (
                <>
                  <CheckCircle2 size={16} color="#4ade80" />
                  <ThemedText style={styles.statusTextSuccess}>
                    {renderSuccessMessage ? renderSuccessMessage() : "连通成功"}
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
