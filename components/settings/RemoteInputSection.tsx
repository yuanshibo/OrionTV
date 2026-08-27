import React, { useCallback, useMemo } from "react";
import { View, Switch, StyleSheet, Pressable, Animated, useColorScheme } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { useButtonAnimation } from "@/hooks/useAnimation";
import { Colors } from "@/constants/Colors";

interface RemoteInputSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onPress?: () => void;
}

export const RemoteInputSection: React.FC<RemoteInputSectionProps> = ({ onChanged, onFocus, onBlur }) => {
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const colors = Colors[colorScheme];

  const { remoteInputEnabled, setRemoteInputEnabled } = useSettingsStore();
  const { isServerRunning, serverUrl, error } = useRemoteControlStore();
  const [isFocused, setIsFocused] = React.useState(false);
  const animationStyle = useButtonAnimation(isFocused, 1.05);

  const handleToggle = useCallback(
    () => {
      const next = !remoteInputEnabled;
      setRemoteInputEnabled(next);
      onChanged();
    },
    [remoteInputEnabled, setRemoteInputEnabled, onChanged]
  );

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
    <SettingsSection
      focusable
      onFocus={() => {
        setIsFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setIsFocused(false);
        onBlur?.();
      }}
      onPress={handleToggle}
    >
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <ThemedText style={styles.settingName}>启用远程输入</ThemedText>
        </View>
        <Animated.View style={animationStyle}>
          <Switch
            value={remoteInputEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.icon, true: colors.primary }}
            thumbColor={remoteInputEnabled ? colors.tint : colors.icon}
          />
        </Animated.View>
      </View>

      {remoteInputEnabled && (
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>服务状态：</ThemedText>
            <ThemedText style={[styles.statusValue, { color: colors.primary }]}>
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
