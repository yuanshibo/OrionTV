import React, { useCallback, useMemo } from "react";
import { View, Switch, StyleSheet, Pressable, Animated, Platform, useColorScheme } from "react-native";
import { useTVEventHandler } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { useSettingsStore } from "@/stores/settingsStore";
import { useButtonAnimation } from "@/hooks/useAnimation";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface AdBlockSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onPress?: () => void;
}

export const AdBlockSection: React.FC<AdBlockSectionProps> = ({ onChanged, onFocus, onBlur, onPress }) => {
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const colors = Colors[colorScheme];

  const { removeAdsEnabled, setRemoveAdsEnabled } = useSettingsStore();
  const [isFocused, setIsFocused] = React.useState(false);
  const animationStyle = useButtonAnimation(isFocused, 1.2);
  const deviceType = useResponsiveLayout().deviceType;

  const handleToggle = useCallback(
    (enabled: boolean) => {
      setRemoveAdsEnabled(enabled);
      onChanged();
    },
    [setRemoveAdsEnabled, onChanged]
  );

  const handleSectionFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleSectionBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handlePress = () => {
    handleToggle(!removeAdsEnabled);
  }

  // TV遥控器事件处理
  const handleTVEvent = React.useCallback(
    (event: any) => {
      if (isFocused && event.eventType === "select") {
        handleToggle(!removeAdsEnabled);
      }
    },
    [isFocused, removeAdsEnabled, handleToggle]
  );

  useTVEventHandler(handleTVEvent);

  const styles = useMemo(() => StyleSheet.create({
    settingItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
    },
    settingInfo: {
      flex: 1,
    },
    settingName: {
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: colors.icon,
    },
    statusContainer: {
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.border,
      borderRadius: 8,
    },
    statusItem: {
      flexDirection: "row",
      marginBottom: 8,
    },
    statusLabel: {
      fontSize: 14,
      color: colors.text,
      minWidth: 80,
    },
    statusValue: {
      fontSize: 14,
      flex: 1,
    },
  }), [colors]);

  return (
    <SettingsSection focusable onFocus={handleSectionFocus} onBlur={handleSectionBlur}
     {...(Platform.isTV || deviceType === 'tv' ? undefined : { onPress: handlePress })}
     >
      <Pressable style={styles.settingItem} onPress={handlePress} onFocus={handleSectionFocus} onBlur={handleSectionBlur}>
        <View style={styles.settingInfo}>
          <ThemedText style={styles.settingName}>开启去广告</ThemedText>
        </View>
        <Animated.View style={animationStyle}>
          <Switch
            value={removeAdsEnabled}
            onValueChange={() => {}} // 禁用Switch的直接交互
            trackColor={{ false: colors.icon, true: colors.primary }}
            thumbColor={removeAdsEnabled ? colors.tint : colors.icon}
            pointerEvents="none"
          />
        </Animated.View>
      </Pressable>

      {removeAdsEnabled && (
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>拦截提示：</ThemedText>
            <ThemedText style={styles.statusValue}>
              将通过代理服务器过滤 M3U8 中的 #EXT-X-DISCONTINUITY 广告切片。需要服务端支持去广告代理接口。
            </ThemedText>
          </View>
        </View>
      )}
    </SettingsSection>
  );
};
