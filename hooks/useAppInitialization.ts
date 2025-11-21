import { useEffect } from "react";
import { Platform } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import useAuthStore from "@/stores/authStore";
import { useUpdateStore, initUpdateStore } from "@/stores/updateStore";
import { UPDATE_CONFIG } from "@/constants/UpdateConfig";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('useAppInitialization');

export const useAppInitialization = (fontsLoaded: boolean, fontsError: Error | null) => {
  const { loadSettings, remoteInputEnabled, apiBaseUrl } = useSettingsStore();
  const { startServer, stopServer } = useRemoteControlStore();
  const { checkLoginStatus } = useAuthStore();
  const { checkForUpdate, lastCheckTime } = useUpdateStore();
  const responsiveConfig = useResponsiveLayout();

  useEffect(() => {
    const initializeApp = async () => {
      await loadSettings();
    };
    initializeApp();
    initUpdateStore();
  }, [loadSettings]);

  useEffect(() => {
    if (apiBaseUrl) {
      checkLoginStatus(apiBaseUrl);
    }
  }, [apiBaseUrl, checkLoginStatus]);

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync();
      if (fontsError) {
        logger.warn(`Error in loading fonts: ${fontsError}`);
      }
    }
  }, [fontsLoaded, fontsError]);

  useEffect(() => {
    if (fontsLoaded && UPDATE_CONFIG.AUTO_CHECK && Platform.OS === 'android') {
      const shouldCheck = Date.now() - lastCheckTime > UPDATE_CONFIG.CHECK_INTERVAL;
      if (shouldCheck) {
        checkForUpdate(true);
      }
    }
  }, [fontsLoaded, lastCheckTime, checkForUpdate]);

  useEffect(() => {
    if (remoteInputEnabled && responsiveConfig.deviceType !== "mobile") {
      startServer();
    } else {
      stopServer();
    }
  }, [remoteInputEnabled, startServer, stopServer, responsiveConfig.deviceType]);
};
