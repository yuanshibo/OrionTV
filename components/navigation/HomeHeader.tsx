import React, { useCallback, useRef } from 'react';
import { View, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { Search, Settings, LogOut, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import useAuthStore from '@/stores/authStore';
import { useHomeUIStore } from '@/stores/homeUIStore';

interface HomeHeaderProps {
  styles: {
    headerContainer: any;
    headerTitle: any;
    rightHeaderButtons: any;
    iconButton: any;
  };
  searchButtonRef?: React.RefObject<any>;
  selectedCategoryRef?: React.RefObject<any>;
}

export const HomeHeader = React.memo(({ styles, searchButtonRef, selectedCategoryRef }: HomeHeaderProps) => {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const { isLoggedIn, logout } = useAuthStore();
  const setCurrentFocusArea = useHomeUIStore((s) => s.setCurrentFocusArea);
  const internalSearchRef = useRef<View>(null);
  const activeSearchRef = searchButtonRef || internalSearchRef;

  const handleHeaderFocus = useCallback(() => {
    setCurrentFocusArea('header');
  }, [setCurrentFocusArea]);

  return (
    <View style={styles.headerContainer}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ThemedText style={styles.headerTitle}>首页</ThemedText>
      </View>
      <View style={styles.rightHeaderButtons}>
        <StyledButton
          ref={activeSearchRef}
          style={styles.iconButton}
          onPress={() => router.push({ pathname: '/search' })}
          onFocus={handleHeaderFocus}
          variant="ghost"
        >
          <Search color={Colors[colorScheme].tint} size={24} />
        </StyledButton>
        <StyledButton
          style={styles.iconButton}
          onPress={() => router.push('/favorites')}
          onFocus={handleHeaderFocus}
          variant="ghost"
        >
          <Heart color={Colors[colorScheme].tint} size={24} />
        </StyledButton>
        <StyledButton
          style={styles.iconButton}
          onPress={() => router.push('/settings')}
          onFocus={handleHeaderFocus}
          variant="ghost"
        >
          <Settings color={Colors[colorScheme].tint} size={24} />
        </StyledButton>
        {isLoggedIn && (
          <StyledButton
            style={styles.iconButton}
            onPress={logout}
            onFocus={handleHeaderFocus}
            variant="ghost"
          >
            <LogOut color={Colors[colorScheme].tint} size={24} />
          </StyledButton>
        )}
      </View>
    </View>
  );
});

HomeHeader.displayName = 'HomeHeader';

