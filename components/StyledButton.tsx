import React from "react";
import { Pressable, StyleSheet, StyleProp, ViewStyle, PressableProps, TextStyle, useColorScheme } from "react-native";
import { ThemedText } from "./ThemedText";
import { Colors } from "@/constants/Colors";

interface StyledButtonProps extends PressableProps {
  children?: React.ReactNode;
  text?: string;
  variant?: "default" | "primary" | "ghost";
  isSelected?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const StyledButton: React.FC<StyledButtonProps> = ({
  children,
  text,
  variant = "default",
  isSelected = false,
  style,
  textStyle,
  ...rest
}) => {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const variantStyles = {
    default: StyleSheet.create({
      button: {
        backgroundColor: colors.border,
      },
      text: {
        color: colors.text,
      },
      selectedButton: {
        backgroundColor: colors.tint,
      },
      focusedButton: {
        backgroundColor: colors.link,
        borderColor: colors.background,
      },
      selectedText: {
        color: Colors.dark.text,
      },
    }),
    primary: StyleSheet.create({
      button: {
        backgroundColor: "transparent",
      },
      text: {
        color: colors.text,
      },
      focusedButton: {
        backgroundColor: colors.link,
        borderColor: colors.background,
      },
      selectedButton: {
        backgroundColor: "rgba(0, 122, 255, 0.3)",
        transform: [{ scale: 1.1 }],
      },
      selectedText: {
        color: colors.link,
      },
    }),
    ghost: StyleSheet.create({
      button: {
        backgroundColor: "transparent",
      },
      text: {
        color: colors.text,
      },
      focusedButton: {
        backgroundColor: "rgba(119, 119, 119, 0.9)",
      },
      selectedButton: {},
      selectedText: {},
    }),
  };

  const styles = StyleSheet.create({
    button: {
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 8,
      margin: 5,
      borderWidth: 2,
      borderColor: "transparent",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    focusedButton: {
      backgroundColor: colors.link,
      borderColor: colors.background,
      transform: [{ scale: 1.1 }],
      elevation: 5,
      shadowColor: colors.link,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 15,
    },
    selectedButton: {
      backgroundColor: colors.tint,
    },
    text: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.text,
    },
    selectedText: {
      color: Colors.dark.text,
    },
  });

  return (
    <Pressable
      style={({ focused }) => [
        styles.button,
        variantStyles[variant].button,
        isSelected && (variantStyles[variant].selectedButton ?? styles.selectedButton),
        focused && (variantStyles[variant].focusedButton ?? styles.focusedButton),
        style,
      ]}
      {...rest}
    >
      {text ? (
        <ThemedText
          style={[
            styles.text,
            variantStyles[variant].text,
            isSelected && (variantStyles[variant].selectedText ?? styles.selectedText),
            textStyle,
          ]}
        >
          {text}
        </ThemedText>
      ) : (
        children
      )}
    </Pressable>
  );
};
