import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import LoginModal from "@/components/LoginModal";
import useAuthStore from "@/stores/authStore";
import { useUpdateStore, initUpdateStore } from "@/stores/updateStore";
import { UpdateModal } from "@/components/UpdateModal";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { UPDATE_CONFIG } from "@/constants/UpdateConfig";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useMemoryManagement } from "@/hooks/useMemoryManagement";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('RootLayout');

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = "dark";
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const { loadSettings, remoteInputEnabled } = useSettingsStore();
  const { startServer, stopServer } = useRemoteControlStore();
  const { checkLoginStatus } = useAuthStore();
  const { checkForUpdate, lastCheckTime } = useUpdateStore();
  const responsiveConfig = useResponsiveLayout();

  // Use global memory management
  useMemoryManagement();

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Parallelize settings loading and font loading
        await Promise.all([
          loadSettings(),
          // Wait for fonts to load or error
          new Promise<void>((resolve) => {
            if (loaded || error) resolve();
            else {
              // This is a bit hacky but ensures we don't block forever if font hook is slow
              const checkInterval = setInterval(() => {
                if (loaded || error) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 50);
            }
          })
        ]);

        // After settings are loaded, check auth status if we have a base URL
        const currentApiBaseUrl = useSettingsStore.getState().apiBaseUrl;
        if (currentApiBaseUrl) {
          await checkLoginStatus(currentApiBaseUrl);
        }
      } catch (e) {
        logger.warn(`Error during initialization: ${e}`);
      } finally {
        setIsReady(true);
      }
    }

    prepare();
    initUpdateStore();
  }, [loadSettings, checkLoginStatus, loaded, error]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // 检查更新
  useEffect(() => {
    if (loaded && UPDATE_CONFIG.AUTO_CHECK && Platform.OS === 'android') {
      // 检查是否需要自动检查更新
      const shouldCheck = Date.now() - lastCheckTime > UPDATE_CONFIG.CHECK_INTERVAL;
      if (shouldCheck) {
        checkForUpdate(true); // 静默检查
      }
    }
  }, [loaded, lastCheckTime, checkForUpdate]);

  useEffect(() => {
    // 只有在非手机端才启动远程控制服务器
    if (remoteInputEnabled && responsiveConfig.deviceType !== "mobile") {
      startServer();
    } else {
      stopServer();
    }
  }, [remoteInputEnabled, startServer, stopServer, responsiveConfig.deviceType]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <View style={styles.container}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="detail" options={{ headerShown: false }} />
              <Stack.Screen name="play" options={{ headerShown: false }} />
              <Stack.Screen name="related" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </View>
          <Toast />
          <LoginModal />
          <UpdateModal />
          <DeleteConfirmationModal />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
