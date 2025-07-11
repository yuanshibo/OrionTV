import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { StyledButton } from "@/components/StyledButton";
import { useSettingsStore } from "@/stores/settingsStore";
import { APIConfigSection } from "@/components/settings/APIConfigSection";
import { LiveStreamSection } from "@/components/settings/LiveStreamSection";
import { RemoteInputSection } from "@/components/settings/RemoteInputSection";
import { PlaySourceSection } from "@/components/settings/PlaybackSourceSection";

export default function SettingsScreen() {
  const { loadSettings, saveSettings } = useSettingsStore();

  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await saveSettings();
      setHasChanges(false);
      Alert.alert("成功", "设置已保存");
    } catch {
      Alert.alert("错误", "保存设置失败");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsChanged = () => {
    setHasChanges(true);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>设置</ThemedText>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <RemoteInputSection onChanged={markAsChanged} />
        <APIConfigSection onChanged={markAsChanged} />
        <LiveStreamSection onChanged={markAsChanged} />
        <PlaySourceSection onChanged={markAsChanged} />
      </ScrollView>

      <View style={styles.footer}>
        <StyledButton
          text={isLoading ? "保存中..." : "保存设置"}
          onPress={handleSave}
          variant="primary"
          disabled={!hasChanges || isLoading}
          style={[styles.saveButton, (!hasChanges || isLoading) && styles.disabledButton]}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    paddingTop: 24,
  },
  backButton: {
    minWidth: 100,
  },
  scrollView: {
    flex: 1,
  },
  footer: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  saveButton: {
    minHeight: 50,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
