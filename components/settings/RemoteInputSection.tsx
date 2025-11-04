import React, { useCallback, useMemo } from "react";
import { View, Switch, StyleSheet, Pressable, Animated, Platform, useColorScheme } from "react-native";
import { useTVEventHandler } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { useButtonAnimation } from "@/hooks/useAnimation";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface RemoteInputSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onPress?: () => void;
}

export const RemoteInputSection: React.FC<RemoteInputSectionProps> = ({ onChanged, onFocus, onBlur, onPress }) => {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const { remoteInputEnabled, setRemoteInputEnabled } = useSettingsStore();
  const { isServerRunning, serverUrl, error } = useRemoteControlStore();
  const [isFocused, setIsFocused] = React.useState(false);
  const animationStyle = useButtonAnimation(isFocused, 1.2);
  const deviceType = useResponsiveLayout().deviceType;

  const handleToggle = useCallback(
    (enabled: boolean) => {
      setRemoteInputEnabled(enabled);
      onChanged();
    },
    [setRemoteInputEnabled, onChanged]
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
    handleToggle(!remoteInputEnabled);
  }

  // TV遥控器事件处理
  const handleTVEvent = React.useCallback(
    (event: any) => {
      if (isFocused && event.eventType === "select") {
        handleToggle(!remoteInputEnabled);
      }
    },
    [isFocused, remoteInputEnabled, handleToggle]
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
     {...Platform.isTV||deviceType !=='tv'? undefined :{onPress:handlePress}}
     >
      <Pressable style={styles.settingItem} onFocus={handleSectionFocus} onBlur={handleSectionBlur}>
        <View style={styles.settingInfo}>
          <ThemedText style={styles.settingName}>启用远程输入</ThemedText>
        </View>
        <Animated.View style={animationStyle}>
          <Switch
            value={remoteInputEnabled}
            onValueChange={() => {}} // 禁用Switch的直接交互
            trackColor={{ false: colors.icon, true: colors.primary }}
            thumbColor={remoteInputEnabled ? colors.tint : colors.icon}
            pointerEvents="none"
          />
        </Animated.View>
      </Pressable>

      {remoteInputEnabled && (
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>服务状态：</ThemedText>
            <ThemedText style={[styles.statusValue, { color: isServerRunning ? colors.primary : colors.primary }]}>
              {isServerRunning ? "运行中" : "已停止"}
            </ThemedText>
          </View>

          {serverUrl && (
            <View style={styles.statusItem}>
              <ThemedText style={styles.statusLabel}>访问地址：</ThemedText>
              <ThemedText style={styles.statusValue}>{serverUrl}</ThemedText>
            </View>
          )}

          {error && (
            <View style={styles.statusItem}>
              <ThemedText style={styles.statusLabel}>错误：</ThemedText>
              <ThemedText style={[styles.statusValue, { color: colors.primary }]}>{error}</ThemedText>
            </View>
          )}
        </View>
      )}
    </SettingsSection>
  );
};
