import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, useColorScheme } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Search, Heart, Settings, Tv, Menu, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DeviceUtils } from '@/utils/DeviceUtils';
import { ThemedText } from '@/components/ThemedText';

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  route: string;
  section?: string;
}

const sidebarItems: SidebarItem[] = [
  { key: 'home', label: '首页', icon: Home, route: '/', section: 'main' },
  { key: 'search', label: '搜索', icon: Search, route: '/search', section: 'main' },
  { key: 'live', label: '直播', icon: Tv, route: '/live', section: 'main' },
  { key: 'favorites', label: '收藏', icon: Heart, route: '/favorites', section: 'user' },
  { key: 'settings', label: '设置', icon: Settings, route: '/settings', section: 'user' },
];

interface TabletSidebarNavigatorProps {
  children: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

const TabletSidebarNavigator: React.FC<TabletSidebarNavigatorProps> = ({
  children,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { spacing, isPortrait } = useResponsiveLayout();
  
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  
  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse(!collapsed);
    } else {
      setInternalCollapsed(!collapsed);
    }
  };

  const handleItemPress = (route: string) => {
    if (route === '/') {
      router.push('/');
    } else {
      router.push(route as any);
    }
    
    if (isPortrait && !controlledCollapsed) {
      setInternalCollapsed(true);
    }
  };

  const isItemActive = (route: string) => {
    if (route === '/' && pathname === '/') return true;
    if (route !== '/' && pathname === route) return true;
    return false;
  };

  const sidebarWidth = collapsed ? 60 : 200;
  const dynamicStyles = useMemo(() => createStyles(spacing, sidebarWidth, isPortrait, colors), [spacing, sidebarWidth, isPortrait, colors]);

  const renderSidebarItems = () => {
    const sections = ['main', 'user'];
    
    return sections.map((section) => {
      const sectionItems = sidebarItems.filter(item => item.section === section);
      
      return (
        <View key={section} style={dynamicStyles.section}>
          {!collapsed && (
            <ThemedText style={dynamicStyles.sectionTitle}>
              {section === 'main' ? '主要功能' : '用户'}
            </ThemedText>
          )}
          {sectionItems.map((item) => {
            const isActive = isItemActive(item.route);
            const IconComponent = item.icon;
            
            return (
              <TouchableOpacity
                key={item.key}
                style={[dynamicStyles.sidebarItem, isActive && dynamicStyles.activeSidebarItem]}
                onPress={() => handleItemPress(item.route)}
                activeOpacity={0.7}
              >
                <IconComponent
                  size={20}
                  color={isActive ? colors.primary : colors.icon}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {!collapsed && (
                  <Text style={[
                    dynamicStyles.sidebarItemLabel,
                    isActive && dynamicStyles.activeSidebarItemLabel
                  ]}>
                    {item.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    });
  };

  return (
    <View style={dynamicStyles.container}>
      {/* 侧边栏 */}
      <View style={[dynamicStyles.sidebar, collapsed && dynamicStyles.collapsedSidebar]}>
        {/* 侧边栏头部 */}
        <View style={dynamicStyles.sidebarHeader}>
          <TouchableOpacity
            onPress={handleToggleCollapse}
            style={dynamicStyles.toggleButton}
            activeOpacity={0.7}
          >
            {collapsed ? (
              <Menu size={20} color={colors.icon} />
            ) : (
              <X size={20} color={colors.icon} />
            )}
          </TouchableOpacity>
          {!collapsed && (
            <ThemedText style={dynamicStyles.appTitle}>OrionTV</ThemedText>
          )}
        </View>

        {/* 侧边栏内容 */}
        <ScrollView style={dynamicStyles.sidebarContent} showsVerticalScrollIndicator={false}>
          {renderSidebarItems()}
        </ScrollView>
      </View>

      {/* 主内容区域 */}
      <View style={dynamicStyles.content}>
        {children}
      </View>
    </View>
  );
};

const createStyles = (spacing: number, sidebarWidth: number, isPortrait: boolean, colors: (typeof Colors.dark) | (typeof Colors.light)) => {
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  return StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
    },
    sidebar: {
      width: sidebarWidth,
      backgroundColor: colors.background,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      zIndex: isPortrait ? 1000 : 1,
    },
    collapsedSidebar: {
      width: 60,
    },
    sidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing,
      paddingVertical: spacing * 1.5,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toggleButton: {
      width: minTouchTarget,
      height: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
    },
    appTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: spacing,
      color: colors.primary,
    },
    sidebarContent: {
      flex: 1,
      paddingTop: spacing,
    },
    section: {
      marginBottom: spacing * 1.5,
    },
    sectionTitle: {
      fontSize: 12,
      color: colors.icon,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: spacing / 2,
      marginHorizontal: spacing,
    },
    sidebarItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing,
      paddingVertical: spacing * 0.75,
      marginHorizontal: spacing / 2,
      borderRadius: 8,
      minHeight: minTouchTarget,
    },
    activeSidebarItem: {
      backgroundColor: hexToRgba(colors.primary, 0.15),
    },
    sidebarItemLabel: {
      fontSize: 14,
      color: colors.icon,
      marginLeft: spacing,
      fontWeight: '500',
    },
    activeSidebarItemLabel: {
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });
};

export default TabletSidebarNavigator;