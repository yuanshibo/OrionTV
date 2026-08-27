import React, { useMemo } from "react";
import { View, StyleSheet, Platform, useColorScheme } from "react-native";
import { ThemedText } from "../ThemedText";
import { StyledButton } from "../StyledButton";
import { SettingsSection } from "./SettingsSection";
import { useUpdateStore } from "@/stores/updateStore";
import { Colors } from "@/constants/Colors";

export function UpdateSection() {
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const colors = Colors[colorScheme];

  const { 
    currentVersion, 
    remoteVersion, 
    updateAvailable, 
    downloading, 
    downloadProgress, 
    checkForUpdate,
    isLatestVersion,
    error
  } = useUpdateStore();

  const [checking, setChecking] = React.useState(false);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      await checkForUpdate(false);
    } finally {
      setChecking(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    sectionTitle: {
      fontSize: Platform.isTV ? 20 : 16,
      fontWeight: "bold",
      marginBottom: 16,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    label: {
      fontSize: Platform.isTV ? 16 : 14,
      color: colors.icon,
    },
    value: {
      fontSize: Platform.isTV ? 16 : 14,
    },
    newVersion: {
      color: colors.primary,
      fontWeight: "bold",
    },
    latestVersion: {
      color: "#4ade80",
      fontWeight: "500",
    },
    errorText: {
      color: "#f87171",
      fontWeight: "500",
    },
    buttonContainer: {
      marginTop: 12,
      alignItems: "center",
    },
    button: {
      width: "100%",
      height: 48,
    },
  }), [colors]);

  return (
    <SettingsSection focusable={false}>
      <ThemedText style={styles.sectionTitle}>应用更新</ThemedText>

      <View style={styles.row}>
        <ThemedText style={styles.label}>当前版本</ThemedText>
        <ThemedText style={styles.value}>v{currentVersion}</ThemedText>
      </View>

      {updateAvailable && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>最新版本</ThemedText>
          <ThemedText style={[styles.value, styles.newVersion]}>v{remoteVersion}</ThemedText>
        </View>
      )}

      {isLatestVersion && remoteVersion && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>状态</ThemedText>
          <ThemedText style={[styles.value, styles.latestVersion]}>已是最新版本</ThemedText>
        </View>
      )}

      {error && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>检查结果</ThemedText>
          <ThemedText style={[styles.value, styles.errorText]}>{error}</ThemedText>
        </View>
      )}

      {downloading && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>下载进度</ThemedText>
          <ThemedText style={styles.value}>{downloadProgress}%</ThemedText>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <StyledButton
          onPress={handleCheckUpdate}
          disabled={checking || downloading}
          text={checking ? "检查中..." : "检查更新"}
          variant="primary"
          style={styles.button}
        />
      </View>
    </SettingsSection>
  );
}
