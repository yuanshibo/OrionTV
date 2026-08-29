import React, { useCallback, useRef } from 'react';
import { View, useColorScheme, findNodeHandle, TVFocusGuideView } from 'react-native';
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
  allCategoryRef?: React.RefObject<any>;
  onSearchButtonMount?: (tag: number) => void;
  selectedCategoryTag?: number;
  allCategoryTag?: number;
}

export const HomeHeader = React.memo(({
  styles,
  searchButtonRef,
  selectedCategoryRef,
  allCategoryRef,
  onSearchButtonMount,
  selectedCategoryTag: propSelectedCategoryTag,
  allCategoryTag: propAllCategoryTag,
}: HomeHeaderProps) => {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const { isLoggedIn, logout } = useAuthStore();
  const setCurrentFocusArea = useHomeUIStore((s) => s.setCurrentFocusArea);
  const internalSearchRef = useRef<View>(null);
  const settingsRef = useRef<View>(null);
  const logoutRef = useRef<View>(null);

  const handleHeaderFocus = useCallback(() => {
    setCurrentFocusArea('header');
  }, [setCurrentFocusArea]);

  const handleSearchRef = useCallback((ref: any) => {
    if (searchButtonRef && 'current' in searchButtonRef) {
      (searchButtonRef as any).current = ref;
    }
    if (internalSearchRef) {
      (internalSearchRef as any).current = ref;
    }
    if (onSearchButtonMount && ref) {
      const tag = findNodeHandle(ref);
      if (tag) onSearchButtonMount(tag);
    }
  }, [searchButtonRef, onSearchButtonMount]);

  const targetCategoryTag = propSelectedCategoryTag ?? (selectedCategoryRef?.current
    ? (findNodeHandle(selectedCategoryRef.current) ?? undefined)
    : undefined);

  const allCategoryTag = propAllCategoryTag ?? (allCategoryRef?.current
    ? (findNodeHandle(allCategoryRef.current) ?? undefined)
    : undefined);

  const settingsTag = settingsRef.current
    ? (findNodeHandle(settingsRef.current) ?? undefined)
    : undefined;

  const logoutTag = logoutRef.current
    ? (findNodeHandle(logoutRef.current) ?? undefined)
    : undefined;

  return (
    <TVFocusGuideView
      trapFocusUp={false}
      trapFocusDown={false}
      destinations={selectedCategoryRef?.current ? [selectedCategoryRef.current] : []}
    >
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ThemedText style={styles.headerTitle}>首页</ThemedText>
        </View>
        <View style={styles.rightHeaderButtons}>
          <StyledButton
            ref={handleSearchRef}
            style={styles.iconButton}
            onPress={() => router.push({ pathname: '/search' })}
            onFocus={handleHeaderFocus}
            nextFocusLeft={allCategoryTag ?? targetCategoryTag}
            nextFocusDown={targetCategoryTag}
            variant="ghost"
          >
            <Search color={Colors[colorScheme].tint} size={24} />
          </StyledButton>
          <StyledButton
            style={styles.iconButton}
            onPress={() => router.push('/favorites')}
            onFocus={handleHeaderFocus}
            nextFocusDown={targetCategoryTag}
            variant="ghost"
          >
            <Heart color={Colors[colorScheme].tint} size={24} />
          </StyledButton>
          <StyledButton
            ref={settingsRef}
            style={styles.iconButton}
            onPress={() => router.push('/settings')}
            onFocus={handleHeaderFocus}
            nextFocusDown={targetCategoryTag}
            nextFocusRight={isLoggedIn ? undefined : settingsTag}
            variant="ghost"
          >
            <Settings color={Colors[colorScheme].tint} size={24} />
          </StyledButton>
          {isLoggedIn && (
            <StyledButton
              ref={logoutRef}
              style={styles.iconButton}
              onPress={logout}
              onFocus={handleHeaderFocus}
              nextFocusDown={targetCategoryTag}
              nextFocusRight={logoutTag}
              variant="ghost"
            >
              <LogOut color={Colors[colorScheme].tint} size={24} />
            </StyledButton>
          )}
        </View>
      </View>
    </TVFocusGuideView>
  );
});

HomeHeader.displayName = 'HomeHeader';

