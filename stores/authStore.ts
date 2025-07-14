import { create } from "zustand";

interface AuthState {
  isLoginModalVisible: boolean;
  showLoginModal: () => void;
  hideLoginModal: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  isLoginModalVisible: false,
  showLoginModal: () => set({ isLoginModalVisible: true }),
  hideLoginModal: () => set({ isLoginModalVisible: false }),
}));

export default useAuthStore;
