import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar, Platform, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ThemedText } from '@/components/ThemedText';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DeviceUtils } from '@/utils/DeviceUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

interface ResponsiveHeaderProps {
  title?: string;
  showBackButton?: boolean;
  rightComponent?: React.ReactNode;
  onBackPress?: () => void;
  showBottomBorder?: boolean;
}

const ResponsiveHeader: React.FC<ResponsiveHeaderProps> = ({
  title,
  showBackButton = false,
  rightComponent,
  onBackPress,
  showBottomBorder = true,
}) => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { deviceType, spacing } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const dynamicStyles = useMemo(() => createStyles(spacing, deviceType, insets, showBottomBorder, colors), [spacing, deviceType, insets, showBottomBorder, colors]);
  
  if (deviceType === 'tv') {
    return null;
  }

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <>
      {Platform.OS === 'android' && <StatusBar backgroundColor={colors.background} barStyle="light-content" />}
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.content}>
          <View style={dynamicStyles.leftSection}>
            {showBackButton && (
              <TouchableOpacity
                onPress={handleBackPress}
                style={dynamicStyles.backButton}
                activeOpacity={0.7}
              >
                <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>

          <View style={dynamicStyles.centerSection}>
            {title && (
              <ThemedText style={dynamicStyles.title} numberOfLines={1}>
                {title}
              </ThemedText>
            )}
          </View>

          <View style={dynamicStyles.rightSection}>
            {rightComponent}
          </View>
        </View>
      </View>
    </>
  );
};

const createStyles = (
  spacing: number,
  deviceType: string,
  insets: any,
  showBottomBorder: boolean,
  colors: (typeof Colors.dark) | (typeof Colors.light)
) => {
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();
  
  return StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      paddingTop: insets.top,
      borderBottomWidth: showBottomBorder ? 1 : 0,
      borderBottomColor: showBottomBorder ? colors.border : 'transparent',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 5,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing,
      paddingVertical: spacing * 0.75,
      minHeight: minTouchTarget + spacing,
    },
    leftSection: {
      width: minTouchTarget + spacing,
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    centerSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rightSection: {
      width: minTouchTarget + spacing,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      flexDirection: 'row',
    },
    backButton: {
      width: minTouchTarget,
      height: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: minTouchTarget / 2,
    },
    title: {
      fontSize: DeviceUtils.getOptimalFontSize(deviceType === 'mobile' ? 18 : 20),
      fontWeight: '600',
      color: colors.text,
    },
  });
};

export default ResponsiveHeader;