import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/services/api";
import { useSettingsStore } from "./settingsStore";
import Toast from "react-native-toast-message";
import Logger from "@/utils/Logger";

const logger = Logger.withTag('AuthStore');

interface AuthState {
  isLoggedIn: boolean;
  authCookie: string | null;
  isLoginModalVisible: boolean;
  showLoginModal: () => void;
  hideLoginModal: () => void;
  checkLoginStatus: (apiBaseUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  authCookie: null,
  isLoginModalVisible: false,
  showLoginModal: () => set({ isLoginModalVisible: true }),
  hideLoginModal: () => set({ isLoginModalVisible: false }),
  checkLoginStatus: async (apiBaseUrl?: string) => {
    if (!apiBaseUrl) {
      set({ isLoggedIn: false, isLoginModalVisible: false, authCookie: null });
      return;
    }
    try {
      const { serverConfig } = useSettingsStore.getState();

      if (!serverConfig?.StorageType) {
        // If config isn't loaded yet, we can't determine auth flow properly.
        // We'll just wait for the next trigger from RootLayout or another component.
        return;
      }

      const authToken = await AsyncStorage.getItem('authCookies');
      if (!authToken) {
        if (serverConfig.StorageType === "localstorage") {
          const loginResult = await api.login().catch(() => {
            set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
          });
          if (loginResult && loginResult.ok) {
            const newCookie = await AsyncStorage.getItem('authCookies');
            set({ isLoggedIn: true, authCookie: newCookie });
          }
        } else {
          set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
        }
      } else {
        set({ isLoggedIn: true, isLoginModalVisible: false, authCookie: authToken });
      }
    } catch (error) {
      logger.error("Failed to check login status:", error);
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
      } else {
        set({ isLoggedIn: false, authCookie: null });
      }
    }
  },
  logout: async () => {
    try {
      await api.logout();
      set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
    } catch (error) {
      logger.error("Failed to logout:", error);
    }
  },
}));

export default useAuthStore;