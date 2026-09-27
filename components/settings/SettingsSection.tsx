import React, { useState, useMemo } from "react";
import { StyleSheet, Pressable, Platform, useColorScheme, ViewStyle, StyleProp, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface SettingsSectionProps {
  children: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
  onPress?: () => void;
  focusable?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  children,
  onFocus,
  onBlur,
  onPress,
  focusable = false,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { deviceType } = useResponsiveLayout();
  const colorScheme = useColorScheme() === "light" ? "light" : "dark";
  const colors = Colors[colorScheme];

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handlePress = () => {
    onPress?.();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          padding: deviceType === "tv" ? 22 : 18,
          marginBottom: 16,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          backgroundColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.03)" : "#ffffff",
        },
        sectionFocused: {
          borderColor: colors.primary,
          backgroundColor: colorScheme === "dark" ? "rgba(210, 105, 30, 0.08)" : "rgba(255, 165, 0, 0.08)",
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 4,
        },
        sectionPressable: {
          width: "100%",
        },
      }),
    [colors, colorScheme, deviceType]
  );

  if (!focusable) {
    return <View style={[styles.section, style]}>{children}</View>;
  }

  return (
    <View style={[styles.section, isFocused && styles.sectionFocused, style]}>
      <Pressable
        android_ripple={
          Platform.isTV || deviceType !== "tv"
            ? { color: "transparent" }
            : { color: colors.link }
        }
        style={styles.sectionPressable}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPress={handlePress}
      >
        {children}
      </Pressable>
    </View>
  );
};
