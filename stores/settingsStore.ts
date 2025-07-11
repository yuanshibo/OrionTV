import { create } from 'zustand';
import { SettingsManager } from '@/services/storage';
import { api } from '@/services/api';
import useHomeStore from './homeStore';


interface SettingsState {
  apiBaseUrl: string;
  m3uUrl: string;
  remoteInputEnabled: boolean;
  videoSource: {
    enabledAll: boolean;
    sources: {
      [key: string]: boolean;
    };
  };
  isModalVisible: boolean;
  loadSettings: () => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  setM3uUrl: (url: string) => void;
  setRemoteInputEnabled: (enabled: boolean) => void;
  saveSettings: () => Promise<void>;
  setVideoSource: (config: { enabledAll: boolean; sources: {[key: string]: boolean} }) => void;
  showModal: () => void;
  hideModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiBaseUrl: '',
  m3uUrl: 'https://raw.githubusercontent.com/sjnhnp/adblock/refs/heads/main/filtered_http_only_valid.m3u',
  liveStreamSources: [],
  remoteInputEnabled: false,
  isModalVisible: false,
  videoSource: {
    enabledAll: true,
    sources: {},
  },
  loadSettings: async () => {
    const settings = await SettingsManager.get();
    set({ 
      apiBaseUrl: settings.apiBaseUrl,
      m3uUrl: settings.m3uUrl,
      remoteInputEnabled: settings.remoteInputEnabled || false,
      videoSource: settings.videoSource || {
        enabledAll: true,
        sources: {},
      },
    });
    api.setBaseUrl(settings.apiBaseUrl);
  },
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  setM3uUrl: (url) => set({ m3uUrl: url }),
  setRemoteInputEnabled: (enabled) => set({ remoteInputEnabled: enabled }),
  setVideoSource: (config) => set({ videoSource: config }),
  saveSettings: async () => {
    const { apiBaseUrl, m3uUrl, remoteInputEnabled, videoSource } = get();
    await SettingsManager.save({ 
      apiBaseUrl,
      m3uUrl,
      remoteInputEnabled,
      videoSource,
    });
    api.setBaseUrl(apiBaseUrl);
    set({ isModalVisible: false });
    useHomeStore.getState().fetchInitialData();
  },
  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),
}));