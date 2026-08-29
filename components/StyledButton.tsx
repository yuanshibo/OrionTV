import React, { forwardRef, memo, useMemo } from "react";
import { Pressable, StyleSheet, StyleProp, ViewStyle, PressableProps, TextStyle, View, Platform, TextProps } from "react-native";
import Reanimated from "react-native-reanimated";
import { ThemedText } from "./ThemedText";
import { Colors } from "@/constants/Colors";
import { useButtonAnimation } from "@/hooks/useAnimation";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface StyledButtonProps extends PressableProps {
  children?: React.ReactNode;
  text?: string;
  variant?: "default" | "primary" | "ghost";
  isSelected?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  focusScale?: number;
  focusedStyle?: StyleProp<ViewStyle>;
  buttonStyle?: StyleProp<ViewStyle>;
  textProps?: TextProps;
}

// Static base styles - created once
const baseStyles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "500",
  },
});

// Variant-specific static styles
const variantBaseStyles = {
  default: StyleSheet.create({
    button: {
      backgroundColor: Colors.dark.border,
    },
    text: {
      color: Colors.dark.text,
    },
  }),
  primary: StyleSheet.create({
    button: {
      backgroundColor: "transparent",
    },
    text: {
      color: Colors.dark.text,
    },
  }),
  ghost: StyleSheet.create({
    button: {
      backgroundColor: "transparent",
    },
    text: {
      color: Colors.dark.text,
    },
  }),
};

export const StyledButton = memo(forwardRef<View, StyledButtonProps>(
  ({ children, text, variant = "default", isSelected = false, style, buttonStyle, textStyle, textProps, onLongPress, focusScale = 1.1, focusedStyle, ...rest }, ref) => {
    const colorScheme = "dark";
    const colors = Colors[colorScheme];
    const [isFocused, setIsFocused] = React.useState(false);
    const animationStyle = useButtonAnimation(isFocused, focusScale);
    const deviceType = useResponsiveLayout().deviceType;

    // Memoize dynamic styles that depend on colors
    const dynamicStyles = useMemo(() => ({
      default: {
        selectedButton: {
          backgroundColor: colors.primary,
          borderColor: "transparent",
        },
        focusedButton: {
          borderColor: "#FFFFFF",
          borderWidth: 2,
          shadowColor: "#FFFFFF",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 5,
          elevation: 4,
        },
        focusedSelectedButton: {
          backgroundColor: colors.primary,
          borderColor: "#FFFFFF",
          borderWidth: 2,
          shadowColor: "#FFFFFF",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 8,
          elevation: 6,
        },
        selectedText: { color: Colors.dark.text },
      },
      primary: {
        focusedButton: {
          backgroundColor: colors.primary,
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
        focusedSelectedButton: {
          backgroundColor: colors.primary,
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
        selectedButton: {
          backgroundColor: colors.primary,
          borderColor: "transparent",
        },
        selectedText: { color: Colors.dark.text },
      },
      ghost: {
        focusedButton: {
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
        focusedSelectedButton: {
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
        selectedButton: {
          backgroundColor: "transparent",
          borderColor: "transparent",
        },
        selectedText: { color: colors.link, fontWeight: "700" as const },
      },
      common: {
        focusedButton: {
          borderColor: "#FFFFFF",
          borderWidth: 2,
          elevation: 5,
          shadowColor: "#FFFFFF",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 8,
        },
        selectedButton: {
          backgroundColor: colors.tint,
        },
        text: {
          color: colors.text,
        },
        selectedText: {
          color: Colors.dark.text,
        },
      }
    }), [colors]);

    return (
      <Reanimated.View style={[animationStyle, style]}>
        <Pressable
          android_ripple={Platform.isTV || deviceType !== 'tv' ? { color: 'transparent' } : { color: Colors.dark.link }}
          ref={ref}
          onFocus={(e) => {
            setIsFocused(true);
            if (rest.onFocus) {
              rest.onFocus(e);
            }
          }}
          onBlur={(e) => {
            setIsFocused(false);
            if (rest.onBlur) {
              rest.onBlur(e);
            }
          }}
          onLongPress={onLongPress}
          style={({ focused }) => [
            baseStyles.button,
            variantBaseStyles[variant].button,
            isSelected && (dynamicStyles[variant].selectedButton ?? dynamicStyles.common.selectedButton),
            buttonStyle,
            focused && (
              focusedStyle ??
              (isSelected
                ? ((dynamicStyles[variant] as any).focusedSelectedButton ?? dynamicStyles[variant].focusedButton)
                : dynamicStyles[variant].focusedButton) ??
              dynamicStyles.common.focusedButton
            ),
          ]}
          {...rest}
        >
          {text ? (
            <ThemedText
              style={[
                baseStyles.text,
                variantBaseStyles[variant].text,
                dynamicStyles.common.text,
                isSelected && (dynamicStyles[variant].selectedText ?? dynamicStyles.common.selectedText),
                textStyle,
              ]}
              {...textProps}
            >
              {text}
            </ThemedText>
          ) : (
            children
          )}
        </Pressable>
      </Reanimated.View>
    );
  }
));

StyledButton.displayName = "StyledButton";
