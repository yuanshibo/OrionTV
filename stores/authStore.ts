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
      // Wait for server config to be loaded if it's currently loading
      let serverConfig = useSettingsStore.getState().serverConfig;

      if (useSettingsStore.getState().isLoadingServerConfig) {
        // Wait up to 3 seconds for server config to load
        const maxWaitTime = 3000;
        const checkInterval = 100;
        let waitTime = 0;

        while (waitTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
          const currentState = useSettingsStore.getState();
          if (!currentState.isLoadingServerConfig) {
            serverConfig = currentState.serverConfig;
            break;
          }
        }
      }

      if (!serverConfig?.StorageType) {
        // Use latest state to avoid stale snapshot bug
        if (!useSettingsStore.getState().isLoadingServerConfig) {
          Toast.show({ type: "error", text1: "请检查网络或者服务器地址是否可用" });
        }
        return;
      }

      const authToken = await AsyncStorage.getItem('authCookies');
      // Treat empty string the same as null (api.logout() sets it to '')
      if (!authToken) {
        if (serverConfig.StorageType === "localstorage") {
          // Auto-login (anonymous mode, no password required)
          const loginResult = await api.login().catch((err) => {
            logger.warn("Auto-login failed:", err);
            set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
          });
          if (loginResult && loginResult.ok) {
            const newCookie = await AsyncStorage.getItem('authCookies');
            set({ isLoggedIn: true, authCookie: newCookie });
          } else if (loginResult && !loginResult.ok) {
            // Server requires password
            Toast.show({ type: "info", text1: "需要登录", text2: "请输入账号密码" });
            set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
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
      // Fully remove cookie from storage (api.logout sets it to '', not null)
      await AsyncStorage.removeItem('authCookies');
      set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
    } catch (error) {
      logger.error("Failed to logout:", error);
    }
  },
}));

export default useAuthStore;