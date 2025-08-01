import React from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { ThemedText } from "../ThemedText";
import { StyledButton } from "../StyledButton";
import { useUpdateStore } from "@/stores/updateStore";
import { UPDATE_CONFIG } from "@/constants/UpdateConfig";

export function UpdateSection() {
  const {
    currentVersion,
    remoteVersion,
    updateAvailable,
    downloading,
    downloadProgress,
    checkForUpdate,
    setShowUpdateModal,
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
          <ThemedText style={[styles.value, styles.newVersion]}>
            v{remoteVersion}
          </ThemedText>
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
          title={checking ? "检查中..." : "检查更新"}
          onPress={handleCheckUpdate}
          disabled={checking || downloading}
          style={styles.button}
        >
          {checking && <ActivityIndicator color="#fff" size="small" />}
        </StyledButton>

        {updateAvailable && !downloading && (
          <StyledButton
            title="立即更新"
            onPress={() => setShowUpdateModal(true)}
            style={[styles.button, styles.updateButton]}
          />
        )}
      </View>

      {UPDATE_CONFIG.AUTO_CHECK && (
        <ThemedText style={styles.hint}>
          自动检查更新已开启，每{UPDATE_CONFIG.CHECK_INTERVAL / (60 * 60 * 1000)}小时检查一次
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: Platform.select({
      ios: "rgba(255, 255, 255, 0.05)",
      android: "rgba(255, 255, 255, 0.05)",
      default: "transparent",
    }),
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: Platform.isTV ? 24 : 20,
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
    fontSize: Platform.isTV ? 18 : 16,
    color: "#999",
  },
  value: {
    fontSize: Platform.isTV ? 18 : 16,
  },
  newVersion: {
    color: "#00bb5e",
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
  updateButton: {
    backgroundColor: "#00bb5e",
  },
  hint: {
    fontSize: Platform.isTV ? 14 : 12,
    color: "#666",
    marginTop: 12,
    textAlign: "center",
  },
});