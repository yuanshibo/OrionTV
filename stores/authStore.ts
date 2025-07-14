import { create } from "zustand";
import Cookies from "@react-native-cookies/cookies";
import { api } from "@/services/api";

interface AuthState {
  isLoggedIn: boolean;
  isLoginModalVisible: boolean;
  showLoginModal: () => void;
  hideLoginModal: () => void;
  checkLoginStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  isLoginModalVisible: false,
  showLoginModal: () => set({ isLoginModalVisible: true }),
  hideLoginModal: () => set({ isLoginModalVisible: false }),
  checkLoginStatus: async () => {
    try {
      const cookies = await Cookies.get(api.baseURL);
      const isLoggedIn = cookies && !!cookies.auth;
      set({ isLoggedIn });
      if (!isLoggedIn) {
        set({ isLoginModalVisible: true });
      }
    } catch (error) {
      console.error("Failed to check login status:", error);
      set({ isLoggedIn: false, isLoginModalVisible: true });
    }
  },
  logout: async () => {
    try {
      await Cookies.clearAll();
      set({ isLoggedIn: false, isLoginModalVisible: true });
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  },
}));

export default useAuthStore;
