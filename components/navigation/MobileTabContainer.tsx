import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, useColorScheme } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Search, Heart, Settings, Tv } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DeviceUtils } from '@/utils/DeviceUtils';
import { useMemo } from 'react';

interface TabItem {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  route: string;
}

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: Home, route: '/' },
  { key: 'search', label: '搜索', icon: Search, route: '/search' },
  { key: 'live', label: '直播', icon: Tv, route: '/live' },
  { key: 'favorites', label: '收藏', icon: Heart, route: '/favorites' },
  { key: 'settings', label: '设置', icon: Settings, route: '/settings' },
];

interface MobileTabContainerProps {
  children: React.ReactNode;
}

const MobileTabContainer: React.FC<MobileTabContainerProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { spacing, deviceType } = useResponsiveLayout();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  // 在手机端过滤掉直播 tab
  const filteredTabs = tabs.filter(tab => 
    deviceType !== 'mobile' || tab.key !== 'live'
  );
  
  const handleTabPress = (route: string) => {
    if (route === '/') {
      router.push('/');
    } else {
      router.push(route as any);
    }
  };

  const isTabActive = (route: string) => {
    if (route === '/' && pathname === '/') return true;
    if (route !== '/' && pathname === route) return true;
    return false;
  };

  const dynamicStyles = useMemo(() => createStyles(spacing, colors), [spacing, colors]);

  return (
    <View style={dynamicStyles.container}>
      {/* 内容区域 */}
      <View style={dynamicStyles.content}>
        {children}
      </View>
      
      {/* 底部导航栏 */}
      <View style={dynamicStyles.tabBar}>
        {filteredTabs.map((tab) => {
          const isActive = isTabActive(tab.route);
          const IconComponent = tab.icon;
          
          return (
            <TouchableOpacity
              key={tab.key}
              style={[dynamicStyles.tab, isActive && dynamicStyles.activeTab]}
              onPress={() => handleTabPress(tab.route)}
              activeOpacity={0.7}
            >
              <IconComponent
                size={20}
                color={isActive ? colors.primary : colors.icon}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text style={[
                dynamicStyles.tabLabel,
                isActive && dynamicStyles.activeTabLabel
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (spacing: number, colors: (typeof Colors.dark) | (typeof Colors.light)) => {
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();
  
  // Function to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing / 2,
      paddingBottom: Platform.OS === 'ios' ? spacing * 2 : spacing,
      paddingHorizontal: spacing,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 10,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: minTouchTarget,
      paddingVertical: spacing / 2,
      borderRadius: 8,
    },
    activeTab: {
      backgroundColor: hexToRgba(colors.primary, 0.1),
    },
    tabLabel: {
      fontSize: 11,
      color: colors.icon,
      marginTop: 2,
      fontWeight: '500',
    },
    activeTabLabel: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
};

export default MobileTabContainer;
