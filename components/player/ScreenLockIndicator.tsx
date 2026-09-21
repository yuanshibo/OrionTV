import React, { memo } from "react";
import { StyleSheet, View, Text } from "react-native";
import { Lock } from "lucide-react-native";

interface ScreenLockIndicatorProps {
  isLocked: boolean;
}

export const ScreenLockIndicator = memo(({ isLocked }: ScreenLockIndicatorProps) => {
  if (!isLocked) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.badge}>
        <Lock size={15} color="#FFA500" strokeWidth={2.5} style={styles.icon} />
        <Text style={styles.text}>画面已锁定</Text>
        <Text style={styles.subText}>长按确认键解锁</Text>
      </View>
    </View>
  );
});

ScreenLockIndicator.displayName = "ScreenLockIndicator";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 24,
    right: 32,
    zIndex: 99,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    marginRight: 6,
  },
  subText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
  },
});
