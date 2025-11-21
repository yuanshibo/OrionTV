import React, { forwardRef, useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, StyleProp, ViewStyle, PressableProps, TextStyle, View, Platform } from "react-native";
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
}

// Static styles moved outside to prevent re-creation on every render
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
  focusedButton: {
    elevation: 5,
    shadowOpacity: 1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
  },
  selectedButton: {
    // Base selected style if needed
  },
  text: {
    fontSize: 16,
    fontWeight: "500",
  },
});

// Helper to get variant styles (memoized outside or just simple functions)
const getVariantStyles = (colors: typeof Colors.dark) => ({
  default: StyleSheet.create({
    button: { backgroundColor: colors.border },
    text: { color: colors.text },
    selectedButton: { backgroundColor: colors.primary },
    focusedButton: { borderColor: colors.primary },
    selectedText: { color: Colors.dark.text },
  }),
  primary: StyleSheet.create({
    button: { backgroundColor: "transparent" },
    text: { color: colors.text },
    focusedButton: { backgroundColor: colors.primary, borderColor: colors.background },
    selectedButton: { backgroundColor: colors.primary },
    selectedText: { color: colors.link },
  }),
  ghost: StyleSheet.create({
    button: { backgroundColor: "transparent" },
    text: { color: colors.text },
    focusedButton: { backgroundColor: "rgba(119, 119, 119, 0.2)", borderColor: colors.primary },
    selectedButton: {},
    selectedText: { color: colors.link },
  }),
});

export const StyledButton = forwardRef<View, StyledButtonProps>(
  ({ children, text, variant = "default", isSelected = false, style, textStyle, onLongPress, ...rest }, ref) => {
    const colorScheme = "dark"; // Enforce dark mode for TV-like interface mostly
    const colors = Colors[colorScheme];
    const [isFocused, setIsFocused] = useState(false);
    const animationStyle = useButtonAnimation(isFocused);
    const { deviceType } = useResponsiveLayout();

    // Memoize variant styles based on current colors (though colors are static currently)
    const variantStyleMap = useMemo(() => getVariantStyles(colors), [colors]);
    const currentVariant = variantStyleMap[variant];

    const textStyles = [
      baseStyles.text,
      currentVariant.text,
      isSelected && currentVariant.selectedText,
      textStyle,
    ];

    // Optimization: Use conditional ripple rendering
    const rippleConfig = useMemo(() =>
      (Platform.isTV || deviceType !== 'tv') ? { color: 'transparent' } : { color: Colors.dark.link },
    [deviceType]);

    return (
      <Animated.View style={[animationStyle, style]}>
        <Pressable
          android_ripple={rippleConfig}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onLongPress={onLongPress}
          style={({ focused }) => [
            baseStyles.button,
            currentVariant.button,
            isSelected && (currentVariant.selectedButton),
            focused && baseStyles.focusedButton,
            focused && { shadowColor: colors.link },
            focused && (currentVariant.focusedButton),
          ]}
          {...rest}
        >
          {text ? (
            <ThemedText style={textStyles}>
              {text}
            </ThemedText>
          ) : (
            children
          )}
        </Pressable>
      </Animated.View>
    );
  }
);

StyledButton.displayName = "StyledButton";
