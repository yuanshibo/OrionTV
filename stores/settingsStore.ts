import { create } from 'zustand';
import { SettingsManager } from '@/services/storage';
import { api } from '@/services/api';
import useHomeStore from './homeStore';

export interface LiveStreamSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface PlaybackSourceConfig {
  primarySource: string;
  fallbackSources: string[];
  enabledSources: string[];
}

interface SettingsState {
  apiBaseUrl: string;
  liveStreamSources: LiveStreamSource[];
  remoteInputEnabled: boolean;
  playbackSourceConfig: PlaybackSourceConfig;
  isModalVisible: boolean;
  loadSettings: () => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  setLiveStreamSources: (sources: LiveStreamSource[]) => void;
  addLiveStreamSource: (source: Omit<LiveStreamSource, 'id'>) => void;
  removeLiveStreamSource: (id: string) => void;
  updateLiveStreamSource: (id: string, updates: Partial<LiveStreamSource>) => void;
  setRemoteInputEnabled: (enabled: boolean) => void;
  setPlaybackSourceConfig: (config: PlaybackSourceConfig) => void;
  saveSettings: () => Promise<void>;
  showModal: () => void;
  hideModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiBaseUrl: 'https://orion-tv.edu.deal',
  liveStreamSources: [],
  remoteInputEnabled: false,
  playbackSourceConfig: {
    primarySource: 'default',
    fallbackSources: [],
    enabledSources: ['default'],
  },
  isModalVisible: false,
  loadSettings: async () => {
    const settings = await SettingsManager.get();
    set({ 
      apiBaseUrl: settings.apiBaseUrl,
      liveStreamSources: settings.liveStreamSources || [],
      remoteInputEnabled: settings.remoteInputEnabled || false,
      playbackSourceConfig: settings.playbackSourceConfig || {
        primarySource: 'default',
        fallbackSources: [],
        enabledSources: ['default'],
      },
    });
    api.setBaseUrl(settings.apiBaseUrl);
  },
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  setLiveStreamSources: (sources) => set({ liveStreamSources: sources }),
  addLiveStreamSource: (source) => {
    const { liveStreamSources } = get();
    const newSource = {
      ...source,
      id: Date.now().toString(),
    };
    set({ liveStreamSources: [...liveStreamSources, newSource] });
  },
  removeLiveStreamSource: (id) => {
    const { liveStreamSources } = get();
    set({ liveStreamSources: liveStreamSources.filter(s => s.id !== id) });
  },
  updateLiveStreamSource: (id, updates) => {
    const { liveStreamSources } = get();
    set({ 
      liveStreamSources: liveStreamSources.map(s => 
        s.id === id ? { ...s, ...updates } : s
      )
    });
  },
  setRemoteInputEnabled: (enabled) => set({ remoteInputEnabled: enabled }),
  setPlaybackSourceConfig: (config) => set({ playbackSourceConfig: config }),
  saveSettings: async () => {
    const { apiBaseUrl, liveStreamSources, remoteInputEnabled, playbackSourceConfig } = get();
    await SettingsManager.save({ 
      apiBaseUrl,
      liveStreamSources,
      remoteInputEnabled,
      playbackSourceConfig,
    });
    api.setBaseUrl(apiBaseUrl);
    set({ isModalVisible: false });
    useHomeStore.getState().fetchInitialData();
  },
  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),
}));