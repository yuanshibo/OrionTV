import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Heart, Search, Settings, Tv } from 'lucide-react-native';
import { ThemedText } from '@/components/ThemedText';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DeviceUtils } from '@/utils/DeviceUtils';
import { Colors } from '@/constants/Colors';

interface NavigationItem {
  name: string;
  label: string;
  icon: any;
  route: string;
}

const navigationItems: NavigationItem[] = [
  {
    name: 'home',
    label: '首页',
    icon: Home,
    route: '/',
  },
  {
    name: 'live',
    label: '直播',
    icon: Tv,
    route: '/live',
  },
  {
    name: 'search',
    label: '搜索',
    icon: Search,
    route: '/search',
  },
  {
    name: 'favorites',
    label: '收藏',
    icon: Heart,
    route: '/favorites',
  },
  {
    name: 'settings',
    label: '设置',
    icon: Settings,
    route: '/settings',
  },
];

export const MobileBottomNavigation: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const responsiveConfig = useResponsiveLayout();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (responsiveConfig.deviceType !== 'mobile') {
    return null;
  }

  const filteredNavigationItems = navigationItems.filter(item => 
    responsiveConfig.deviceType !== 'mobile' || item.name !== 'live'
  );

  const handleNavigation = (route: string) => {
    if (route === '/') {
      router.push('/');
    } else {
      router.push(route as any);
    }
  };

  const isActiveRoute = (route: string) => {
    if (route === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(route);
  };

  return (
    <View style={styles.container}>
      {filteredNavigationItems.map((item) => {
        const isActive = isActiveRoute(item.route);
        const IconComponent = item.icon;

        return (
          <TouchableOpacity
            key={item.name}
            style={styles.tabItem}
            onPress={() => handleNavigation(item.route)}
            activeOpacity={0.7}
          >
            <IconComponent
              size={24}
              color={isActive ? colors.primary : colors.icon}
            />
            <ThemedText
              style={[
                styles.tabLabel,
                { color: isActive ? colors.primary : colors.icon },
              ]}
            >
              {item.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (colors: (typeof Colors.dark) | (typeof Colors.light)) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 84, // 49 + 35 for safe area
    paddingBottom: 35, // Safe area padding
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 0.5,
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: DeviceUtils.getMinTouchTargetSize(),
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default MobileBottomNavigation;