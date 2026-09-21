import React, { memo, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  useColorScheme,
  StyleProp,
  ViewStyle,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { Delete, Trash2, Space } from "lucide-react-native";

const KEY_MATRIX: string[][] = [
  ["A", "B", "C", "D", "E", "F"],
  ["G", "H", "I", "J", "K", "L"],
  ["M", "N", "O", "P", "Q", "R"],
  ["S", "T", "U", "V", "W", "X"],
  ["Y", "Z", "0", "1", "2", "3"],
  ["4", "5", "6", "7", "8", "9"],
];

interface TVVirtualKeyboardProps {
  onKeyPress: (char: string) => void;
  onDelete: () => void;
  onClear: () => void;
  nextFocusRightTag?: number;
  style?: StyleProp<ViewStyle>;
  initialFocusKey?: string;
}

export const TVVirtualKeyboard: React.FC<TVVirtualKeyboardProps> = memo(
  ({
    onKeyPress,
    onDelete,
    onClear,
    nextFocusRightTag,
    style,
    initialFocusKey = "A",
  }) => {
    const colorScheme = useColorScheme() === "light" ? "light" : "dark";
    const colors = Colors[colorScheme];
    const [focusedKey, setFocusedKey] = useState<string>(initialFocusKey);
    const hasSetInitialFocus = useRef(false);

    const handleFocus = useCallback((key: string) => {
      setFocusedKey(key);
    }, []);

    return (
      <View style={[styles.container, style]}>
        {/* 6x6 字母与数字网格 */}
        <View style={styles.gridContainer}>
          {KEY_MATRIX.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.row}>
              {row.map((char, colIndex) => {
                const isRightmostCol = colIndex === 5;
                const isCurrentFocused = focusedKey === char;
                const isInitialPreferred = !hasSetInitialFocus.current && char === initialFocusKey;
                if (isInitialPreferred) {
                  hasSetInitialFocus.current = true;
                }

                return (
                  <Pressable
                    key={char}
                    hasTVPreferredFocus={isInitialPreferred}
                    nextFocusRight={isRightmostCol ? nextFocusRightTag : undefined}
                    onFocus={() => handleFocus(char)}
                    onPress={() => onKeyPress(char)}
                    style={({ pressed }) => [
                      styles.keyButton,
                      {
                        backgroundColor: isCurrentFocused
                          ? colors.tint
                          : pressed
                          ? "rgba(255, 255, 255, 0.25)"
                          : "rgba(255, 255, 255, 0.08)",
                        borderColor: isCurrentFocused ? colors.text : "transparent",
                        transform: [{ scale: isCurrentFocused ? 1.08 : 1 }],
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.keyText,
                        {
                          color: isCurrentFocused
                            ? colors.background
                            : colors.text,
                          fontWeight: isCurrentFocused ? "bold" : "600",
                        },
                      ]}
                    >
                      {char}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* 底部操作行（清空、空格、退格） */}
        <View style={styles.actionRow}>
          <Pressable
            hasTVPreferredFocus={false}
            onFocus={() => handleFocus("CLEAR")}
            onPress={onClear}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: focusedKey === "CLEAR"
                  ? colors.tint
                  : pressed
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
                borderColor: focusedKey === "CLEAR" ? colors.text : "transparent",
                transform: [{ scale: focusedKey === "CLEAR" ? 1.05 : 1 }],
              },
            ]}
          >
            <Trash2
              size={18}
              color={focusedKey === "CLEAR" ? colors.background : colors.text}
            />
            <ThemedText
              style={[
                styles.actionText,
                { color: focusedKey === "CLEAR" ? colors.background : colors.text },
              ]}
            >
              清空
            </ThemedText>
          </Pressable>

          <Pressable
            hasTVPreferredFocus={false}
            onFocus={() => handleFocus("SPACE")}
            onPress={() => onKeyPress(" ")}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: focusedKey === "SPACE"
                  ? colors.tint
                  : pressed
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
                borderColor: focusedKey === "SPACE" ? colors.text : "transparent",
                transform: [{ scale: focusedKey === "SPACE" ? 1.05 : 1 }],
              },
            ]}
          >
            <Space
              size={18}
              color={focusedKey === "SPACE" ? colors.background : colors.text}
            />
            <ThemedText
              style={[
                styles.actionText,
                { color: focusedKey === "SPACE" ? colors.background : colors.text },
              ]}
            >
              空格
            </ThemedText>
          </Pressable>

          <Pressable
            hasTVPreferredFocus={false}
            nextFocusRight={nextFocusRightTag}
            onFocus={() => handleFocus("DELETE")}
            onPress={onDelete}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: focusedKey === "DELETE"
                  ? colors.tint
                  : pressed
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
                borderColor: focusedKey === "DELETE" ? colors.text : "transparent",
                transform: [{ scale: focusedKey === "DELETE" ? 1.05 : 1 }],
              },
            ]}
          >
            <Delete
              size={18}
              color={focusedKey === "DELETE" ? colors.background : colors.text}
            />
            <ThemedText
              style={[
                styles.actionText,
                { color: focusedKey === "DELETE" ? colors.background : colors.text },
              ]}
            >
              退格
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }
);

TVVirtualKeyboard.displayName = "TVVirtualKeyboard";

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  gridContainer: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  keyButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  keyText: {
    fontSize: 20,
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 4,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
