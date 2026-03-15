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
  /** 认证流程是否已经完成（用于控制 Splash Screen） */
  isAuthChecked: boolean;
  showLoginModal: () => void;
  hideLoginModal: () => void;
  checkLoginStatus: (apiBaseUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => {
  // 注册全局 401 处理回调：任何 API 请求收到 401 时自动退出登录
  api.onUnauthorized = async () => {
    logger.warn("401 Unauthorized: clearing auth state");
    api.setCookie(null);
    await AsyncStorage.removeItem('authCookies');
    set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
  };

  return {
    isLoggedIn: false,
    authCookie: null,
    isLoginModalVisible: false,
    isAuthChecked: false,

    showLoginModal: () => set({ isLoginModalVisible: true }),
    hideLoginModal: () => set({ isLoginModalVisible: false }),

    checkLoginStatus: async (apiBaseUrl?: string) => {
      try {
        if (!apiBaseUrl) {
          set({ isLoggedIn: false, isLoginModalVisible: false, authCookie: null });
          return;
        }

        // 此处 serverConfig 已由 settingsStore.fetchServerConfig 设置完毕
        // 无需再轮询等待（fetchServerConfig await 了 checkLoginStatus）
        const serverConfig = useSettingsStore.getState().serverConfig;

        if (!serverConfig?.StorageType) {
          Toast.show({ type: "error", text1: "请检查网络或者服务器地址是否可用" });
          return;
        }

        const authToken = await AsyncStorage.getItem('authCookies');
        // authToken 为 null 视为未登录（logout 会 removeItem）
        if (!authToken) {
          if (serverConfig.StorageType === "localstorage") {
            // LocalStorage 模式：无密码，尝试匿名自动登录
            const loginResult = await api.login().catch((err) => {
              logger.warn("Auto-login failed:", err);
              set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
            });
            if (loginResult && loginResult.ok) {
              const newCookie = await AsyncStorage.getItem('authCookies');
              set({ isLoggedIn: true, authCookie: newCookie });
            } else if (loginResult && !loginResult.ok) {
              // 服务器需要密码
              Toast.show({ type: "info", text1: "需要登录", text2: "请输入账号密码" });
              set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
            }
          } else {
            set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
          }
        } else {
          // 有 Cookie，直接恢复登录状态（401 由 onUnauthorized 回调兜底处理）
          api.setCookie(authToken);
          set({ isLoggedIn: true, isLoginModalVisible: false, authCookie: authToken });
        }
      } catch (error) {
        logger.error("Failed to check login status:", error);
        if (error instanceof Error && error.message === "UNAUTHORIZED") {
          set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
        } else {
          set({ isLoggedIn: false, authCookie: null });
        }
      } finally {
        // 无论成功或失败，标记认证流程已完成，允许 Splash 隐藏
        set({ isAuthChecked: true });
      }
    },

    logout: async () => {
      try {
        await api.logout();
      } catch (error) {
        logger.error("Failed to logout (network):", error);
      } finally {
        // 无论 API 调用成功与否，本地 UI 状态必须重置
        set({ isLoggedIn: false, isLoginModalVisible: true, authCookie: null });
      }
    },
  };
});

export default useAuthStore;