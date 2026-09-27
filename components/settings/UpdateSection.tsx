import React, { useMemo } from "react";
import { View, StyleSheet, Platform, useColorScheme } from "react-native";
import { ThemedText } from "../ThemedText";
import { StyledButton } from "../StyledButton";
import { SettingsSection } from "./SettingsSection";
import { useUpdateStore } from "@/stores/updateStore";
import { Colors } from "@/constants/Colors";
import { Sparkles, CheckCircle2 } from "lucide-react-native";

export function UpdateSection() {
  const colorScheme = useColorScheme() === "light" ? "light" : "dark";
  const colors = Colors[colorScheme];

  const {
    currentVersion,
    remoteVersion,
    updateAvailable,
    downloading,
    downloadProgress,
    checkForUpdate,
    isLatestVersion,
    error,
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
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
          fontSize: Platform.isTV ? 18 : 16,
          fontWeight: "bold",
          color: colors.text,
        },
        contentCard: {
          backgroundColor: colorScheme === "dark" ? "rgba(0, 0, 0, 0.25)" : "#f9fafb",
          borderRadius: 10,
          padding: 14,
          borderWidth: 1,
          borderColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
          marginBottom: 14,
          gap: 10,
        },
        row: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        label: {
          fontSize: Platform.isTV ? 15 : 14,
          color: colors.icon,
        },
        value: {
          fontSize: Platform.isTV ? 15 : 14,
          color: colors.text,
          fontWeight: "500",
        },
        newVersion: {
          color: colors.primary,
          fontWeight: "bold",
        },
        statusSuccessRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
        latestVersion: {
          color: "#4ade80",
          fontWeight: "600",
        },
        errorText: {
          color: "#f87171",
          fontWeight: "500",
        },
        buttonContainer: {
          marginTop: 4,
        },
        button: {
          width: "100%",
          height: 48,
          borderRadius: 10,
        },
      }),
    [colors, colorScheme]
  );

  return (
    <SettingsSection focusable={false}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <Sparkles size={18} color={colors.primary} />
        </View>
        <ThemedText style={styles.sectionTitle}>应用版本与更新</ThemedText>
      </View>

      <View style={styles.contentCard}>
        <View style={styles.row}>
          <ThemedText style={styles.label}>当前安装版本</ThemedText>
          <ThemedText style={styles.value}>v{currentVersion}</ThemedText>
        </View>

        {updateAvailable && (
          <View style={styles.row}>
            <ThemedText style={styles.label}>发现新版本</ThemedText>
            <ThemedText style={[styles.value, styles.newVersion]}>v{remoteVersion}</ThemedText>
          </View>
        )}

        {isLatestVersion && remoteVersion && (
          <View style={styles.row}>
            <ThemedText style={styles.label}>检测状态</ThemedText>
            <View style={styles.statusSuccessRow}>
              <CheckCircle2 size={16} color="#4ade80" />
              <ThemedText style={styles.latestVersion}>已是最新版本</ThemedText>
            </View>
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
      </View>

      <View style={styles.buttonContainer}>
        <StyledButton
          onPress={handleCheckUpdate}
          disabled={checking || downloading}
          text={checking ? "检查中..." : updateAvailable ? "立即更新" : "检查新版本"}
          variant="primary"
          style={styles.button}
        />
      </View>
    </SettingsSection>
  );
}
