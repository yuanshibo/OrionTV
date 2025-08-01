import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import MobileBottomTabNavigator from './MobileBottomTabNavigator';
import TabletSidebarNavigator from './TabletSidebarNavigator';

interface ResponsiveNavigationProps {
  children: React.ReactNode;
}

const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({ children }) => {
  const { deviceType } = useResponsiveLayout();

  switch (deviceType) {
    case 'mobile':
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            {children}
          </View>
          <MobileBottomTabNavigator />
        </View>
      );
    
    case 'tablet':
      return (
        <TabletSidebarNavigator>
          {children}
        </TabletSidebarNavigator>
      );
    
    case 'tv':
    default:
      // TV端保持原有的Stack导航，不需要额外的导航容器
      return <>{children}</>;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default ResponsiveNavigation;