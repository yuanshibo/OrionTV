import { create } from 'zustand';
import { SettingsManager } from '@/services/storage';
import { api } from '@/services/api';

interface SettingsState {
  apiBaseUrl: string;
  isModalVisible: boolean;
  loadSettings: () => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  saveSettings: () => Promise<void>;
  showModal: () => void;
  hideModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiBaseUrl: '',
  isModalVisible: false,
  loadSettings: async () => {
    const settings = await SettingsManager.get();
    set({ apiBaseUrl: settings.apiBaseUrl });
    api.setBaseUrl(settings.apiBaseUrl);
  },
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  saveSettings: async () => {
    const { apiBaseUrl } = get();
    await SettingsManager.save({ apiBaseUrl });
    api.setBaseUrl(apiBaseUrl);
    set({ isModalVisible: false });
  },
  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),
}));