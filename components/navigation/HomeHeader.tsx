import React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { Search, Settings, LogOut, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import useAuthStore from '@/stores/authStore';

interface HomeHeaderProps {
  styles: {
    headerContainer: any;
    headerTitle: any;
    rightHeaderButtons: any;
    iconButton: any;
  };
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ styles }) => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const { isLoggedIn, logout } = useAuthStore();

  return (
    <View style={styles.headerContainer}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ThemedText style={styles.headerTitle}>首页</ThemedText>
      </View>
      <View style={styles.rightHeaderButtons}>
        <StyledButton
          style={styles.iconButton}
          onPress={() => router.push({ pathname: '/search' })}
          variant="ghost"
        >
          <Search color={Colors[colorScheme].tint} size={24} />
        </StyledButton>
        <StyledButton style={styles.iconButton} onPress={() => router.push('/favorites')} variant="ghost">
          <Heart color={Colors[colorScheme].tint} size={24} />
        </StyledButton>
        <StyledButton style={styles.iconButton} onPress={() => router.push('/settings')} variant="ghost">
          <Settings color={Colors[colorScheme].tint} size={24} />
        </StyledButton>
        {isLoggedIn && (
          <StyledButton style={styles.iconButton} onPress={logout} variant="ghost">
            <LogOut color={Colors[colorScheme].tint} size={24} />
          </StyledButton>
        )}
      </View>
    </View>
  );
};
