import React, { forwardRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  PressableProps,
  TextStyle,
  Platform,
} from "react-native";
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

const extractMarginStyles = (style?: StyleProp<ViewStyle>) => {
  const flatStyle = (StyleSheet.flatten(style) as ViewStyle | undefined) || {};

  const {
    margin,
    marginHorizontal,
    marginVertical,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginStart,
    marginEnd,
    ...buttonStyle
  } = flatStyle;

  const containerStyle: ViewStyle = {};

  if (typeof margin !== "undefined") containerStyle.margin = margin;
  if (typeof marginHorizontal !== "undefined") containerStyle.marginHorizontal = marginHorizontal;
  if (typeof marginVertical !== "undefined") containerStyle.marginVertical = marginVertical;
  if (typeof marginTop !== "undefined") containerStyle.marginTop = marginTop;
  if (typeof marginBottom !== "undefined") containerStyle.marginBottom = marginBottom;
  if (typeof marginLeft !== "undefined") containerStyle.marginLeft = marginLeft;
  if (typeof marginRight !== "undefined") containerStyle.marginRight = marginRight;
  if (typeof marginStart !== "undefined") containerStyle.marginStart = marginStart;
  if (typeof marginEnd !== "undefined") containerStyle.marginEnd = marginEnd;

  return { containerStyle, buttonStyle };
};

export const StyledButton = forwardRef<View, StyledButtonProps>(
  ({ children, text, variant = "default", isSelected = false, style, textStyle, ...rest }, ref) => {
    const colorScheme = "dark";
    const colors = Colors[colorScheme];
    const [isFocused, setIsFocused] = React.useState(false);
    const animationStyle = useButtonAnimation(isFocused);
    const deviceType = useResponsiveLayout().deviceType;
    const { containerStyle, buttonStyle } = extractMarginStyles(style);

    const variantStyles = {
      default: StyleSheet.create({
        button: {
          backgroundColor: colors.border,
        },
        text: {
          color: colors.text,
        },
        selectedButton: {
          backgroundColor: colors.primary,
        },
        focusedButton: {
          borderColor: colors.primary,
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
          backgroundColor: colors.primary,
          borderColor: colors.background,
        },
        selectedButton: {
          backgroundColor: colors.primary,
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
          backgroundColor: "rgba(119, 119, 119, 0.2)",
          borderColor: colors.primary,
        },
        selectedButton: {
          backgroundColor: "rgba(0, 187, 94, 0.12)",
          borderColor: colors.primary,
        },
        selectedText: {
          color: colors.primary,
        },
      }),
    };

    const styles = StyleSheet.create({
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
        backgroundColor: colors.link,
        borderColor: colors.background,
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
      <Animated.View style={[animationStyle, containerStyle]}>
        <Pressable
          android_ripple={Platform.isTV || deviceType !== "tv" ? { color: "transparent" } : { color: Colors.dark.link }}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={({ focused }) => [
            styles.button,
            variantStyles[variant].button,
            buttonStyle,
            isSelected && (variantStyles[variant].selectedButton ?? styles.selectedButton),
            focused && (variantStyles[variant].focusedButton ?? styles.focusedButton),
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
      </Animated.View>
    );
  }
);

StyledButton.displayName = "StyledButton";
