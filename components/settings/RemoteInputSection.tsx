import React from "react";
import { View, Switch, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";

interface RemoteInputSectionProps {
  onChanged: () => void;
}

export const RemoteInputSection: React.FC<RemoteInputSectionProps> = ({ onChanged }) => {
  const { remoteInputEnabled, setRemoteInputEnabled } = useSettingsStore();
  const { isServerRunning, serverUrl, error } = useRemoteControlStore();

  const handleToggle = async (enabled: boolean) => {
    setRemoteInputEnabled(enabled);
    onChanged();
  };

  return (
    <ThemedView style={styles.section}>
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <ThemedText style={styles.settingName}>启用远程输入</ThemedText>
        </View>
        <Switch
          value={remoteInputEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: "#767577", true: "#007AFF" }}
          thumbColor={remoteInputEnabled ? "#ffffff" : "#f4f3f4"}
        />
      </View>

      {remoteInputEnabled && (
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>服务状态：</ThemedText>
            <ThemedText style={[styles.statusValue, { color: isServerRunning ? "#00FF00" : "#FF6B6B" }]}>
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
              <ThemedText style={[styles.statusValue, { color: "#FF6B6B" }]}>{error}</ThemedText>
            </View>
          )}
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  section: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
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
    color: "#888",
  },
  statusContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#2a2a2c",
    borderRadius: 8,
  },
  statusItem: {
    flexDirection: "row",
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: "#ccc",
    minWidth: 80,
  },
  statusValue: {
    fontSize: 14,
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
});
