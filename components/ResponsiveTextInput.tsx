import React, { forwardRef, useMemo } from 'react';
import { TextInput, View, StyleSheet, ViewStyle, TextStyle, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DeviceUtils } from '@/utils/DeviceUtils';
import { Colors } from '@/constants/Colors';

interface ResponsiveTextInputProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  onFocus?: () => void;
  onBlur?: () => void;
}

const ResponsiveTextInput = forwardRef<TextInput, ResponsiveTextInputProps>(
  (
    {
      placeholder,
      value,
      onChangeText,
      label,
      error,
      secureTextEntry = false,
      keyboardType = 'default',
      multiline = false,
      numberOfLines = 1,
      editable = true,
      style,
      inputStyle,
      onFocus,
      onBlur,
    },
    ref
  ) => {
    const colorScheme = useColorScheme() ?? 'dark';
    const colors = Colors[colorScheme];
    const { deviceType, spacing } = useResponsiveLayout();
    const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType, spacing, colors), [deviceType, spacing, colors]);

    return (
      <View style={[dynamicStyles.container, style]}>
        {label && (
          <ThemedText style={dynamicStyles.label}>{label}</ThemedText>
        )}
        
        <View style={[
          dynamicStyles.inputContainer,
          error ? dynamicStyles.errorContainer : undefined,
          !editable ? dynamicStyles.disabledContainer : undefined,
        ]}>
          <TextInput
            ref={ref}
            style={[dynamicStyles.input, inputStyle]}
            placeholder={placeholder}
            placeholderTextColor={colors.icon}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines : 1}
            editable={editable}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </View>

        {error && (
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        )}
      </View>
    );
  }
);

ResponsiveTextInput.displayName = 'ResponsiveTextInput';

const createResponsiveStyles = (deviceType: string, spacing: number, colors: (typeof Colors.dark) | (typeof Colors.light)) => {
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      marginBottom: spacing,
    },
    label: {
      fontSize: isMobile ? 16 : 14,
      fontWeight: '600',
      marginBottom: spacing * 0.5,
      color: colors.text,
    },
    inputContainer: {
      backgroundColor: colors.border,
      borderRadius: isMobile ? 8 : isTablet ? 10 : 12,
      borderWidth: 2,
      borderColor: 'transparent',
      minHeight: isMobile ? minTouchTarget : isTablet ? 48 : 44,
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      paddingHorizontal: spacing,
      paddingVertical: spacing * 0.75,
      fontSize: isMobile ? 16 : isTablet ? 16 : 14,
      color: colors.text,
      textAlignVertical: 'top', // For multiline inputs
    },
    errorContainer: {
      borderColor: colors.primary,
    },
    disabledContainer: {
      backgroundColor: colors.background,
      opacity: 0.6,
    },
    errorText: {
      fontSize: isMobile ? 14 : 12,
      color: colors.primary,
      marginTop: spacing * 0.25,
    },
  });
};

export default ResponsiveTextInput;