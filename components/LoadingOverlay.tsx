import React, { useMemo } from "react";
import { View, StyleSheet, ActivityIndicator, useColorScheme } from "react-native";
import { Colors } from "@/constants/Colors";

interface LoadingOverlayProps {
  visible: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible }) => {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const styles = useMemo(() => StyleSheet.create({
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
  }), []);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
};
