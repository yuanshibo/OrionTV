import React, { useMemo } from "react";
import { View, StyleSheet, Platform, ActivityIndicator, useColorScheme } from "react-native";
import { ThemedText } from "../ThemedText";
import { StyledButton } from "../StyledButton";
import { useUpdateStore } from "@/stores/updateStore";
import { Colors } from "@/constants/Colors";

export function UpdateSection() {
  const colorScheme = useColorScheme() ?? "dark";
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
    sectionContainer: {
      marginBottom: 24,
      padding: 16,
      backgroundColor: colors.border,
      borderRadius: 8,
    },
    sectionTitle: {
      fontSize: Platform.isTV ? 24 : 20,
      fontWeight: "bold",
      marginBottom: 16,
      paddingTop: 8,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    label: {
      fontSize: Platform.isTV ? 18 : 16,
      color: colors.icon,
    },
    value: {
      fontSize: Platform.isTV ? 18 : 16,
    },
    newVersion: {
      color: colors.primary,
      fontWeight: "bold",
    },
    latestVersion: {
      color: colors.primary,
      fontWeight: "500",
    },
    errorText: {
      color: colors.primary, // Using primary for consistency in warm theme
      fontWeight: "500",
    },
    buttonContainer: {
      flexDirection: "row",
      gap: 12,
      marginTop: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    button: {
      width: "90%",
      ...(Platform.isTV && {
        borderWidth: 2,
        borderColor: "transparent",
      }),
    },
    buttonText: {
      color: colors.text,
      fontSize: Platform.isTV ? 16 : 14,
      fontWeight: "500",
    },
    hint: {
      fontSize: Platform.isTV ? 14 : 12,
      color: colors.icon,
      marginTop: 12,
      textAlign: "center",
    },
  }), [colors]);

  return (
    <View style={styles.sectionContainer}>
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
        <StyledButton onPress={handleCheckUpdate} disabled={checking || downloading} style={styles.button}>
          {checking ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <ThemedText style={styles.buttonText}>检查更新</ThemedText>
          )}
        </StyledButton>
      </View>
    </View>
  );
}
