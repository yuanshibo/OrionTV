import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SettingsManager } from "@/services/storage";
import { api, ServerConfig } from "@/services/api";
import { storageConfig } from "@/services/storageConfig";
import Logger from "@/utils/Logger";

const logger = Logger.withTag('SettingsStore');

import { parseM3U } from "@/services/m3u";

export interface ApiTestResult {
  success: boolean;
  siteName?: string;
  storageType?: string;
  latency?: number;
  error?: string;
}

export interface M3uTestResult {
  success: boolean;
  channelCount?: number;
  sampleChannels?: string[];
  error?: string;
}

export const normalizeUrl = (rawUrl: string, defaultProtocol = "http://"): string => {
  let url = (rawUrl || "").trim();
  if (!url) return "";

  // Remove trailing slashes
  while (url.endsWith("/")) {
    url = url.slice(0, -1);
  }

  if (!/^https?:\/\//i.test(url)) {
    const hostPart = url.split("/")[0];
    const isIpAddress = /^((\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(hostPart);
    const hasPort = /:\d+/.test(hostPart);

    if (isIpAddress || hasPort) {
      url = "http://" + url;
    } else {
      url = defaultProtocol.startsWith("https") ? "https://" + url : "http://" + url;
    }
  }

  return url;
};

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
  serverConfig: ServerConfig | null;
  serverConfigError: string | null;
  isLoadingServerConfig: boolean;
  isTestingApi: boolean;
  isTestingM3u: boolean;
  lastApiTestResult: ApiTestResult | null;
  lastM3uTestResult: M3uTestResult | null;
  loadSettings: () => Promise<void>;
  fetchServerConfig: () => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  setM3uUrl: (url: string) => void;
  setRemoteInputEnabled: (enabled: boolean) => void;
  testApiConnection: (customUrl?: string) => Promise<ApiTestResult>;
  testM3uConnection: (customUrl?: string) => Promise<M3uTestResult>;
  saveSettings: () => Promise<void>;
  setVideoSource: (config: { enabledAll: boolean; sources: { [key: string]: boolean } }) => void;
  showModal: () => void;
  hideModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiBaseUrl: "",
  m3uUrl: "",
  remoteInputEnabled: false,
  isModalVisible: false,
  serverConfig: null,
  serverConfigError: null,
  isLoadingServerConfig: false,
  isTestingApi: false,
  isTestingM3u: false,
  lastApiTestResult: null,
  lastM3uTestResult: null,
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
    if (settings.apiBaseUrl) {
      api.setBaseUrl(settings.apiBaseUrl);
      const authToken = await AsyncStorage.getItem('authCookies');
      if (authToken) {
        api.setCookie(authToken);
      }
      await get().fetchServerConfig();
    } else {
      const useAuthStore = (await import("./authStore")).default;
      useAuthStore.setState({ isAuthChecked: true });
    }
  },
  fetchServerConfig: async () => {
    set({ isLoadingServerConfig: true, serverConfigError: null });
    const maxRetries = 2;
    let lastError: unknown;

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            logger.info(`Retrying fetchServerConfig (attempt ${attempt}/${maxRetries})...`);
          }
          const config = await api.getServerConfig();
          if (config) {
            storageConfig.setStorageType(config.StorageType);
            set({ serverConfig: config, serverConfigError: null });
            const useAuthStore = (await import("./authStore")).default;
            await useAuthStore.getState().checkLoginStatus(get().apiBaseUrl);
          }
          return;
        } catch (error) {
          lastError = error;
          logger.warn(`fetchServerConfig attempt ${attempt + 1} failed:`, error);
        }
      }
      let errorMessage = '服务器连接失败';
      if (lastError instanceof Error) {
        switch (lastError.message) {
          case 'API_URL_NOT_SET':
            errorMessage = 'API地址未设置';
            break;
          case 'UNAUTHORIZED':
            errorMessage = '服务器认证失败';
            break;
          default:
            if (lastError.message.includes('Network')) {
              errorMessage = '网络连接失败，请检查网络或服务器地址';
            } else if (lastError.message.includes('timeout')) {
              errorMessage = '连接超时，请检查服务器地址';
            } else if (lastError.message.includes('404')) {
              errorMessage = '服务器地址无效，请检查API路径';
            } else if (lastError.message.includes('500')) {
              errorMessage = '服务器内部错误';
            }
            break;
        }
      }
      set({ serverConfig: null, serverConfigError: errorMessage });
      logger.error("fetchServerConfig failed after all retries:", lastError);
    } finally {
      set({ isLoadingServerConfig: false });
    }
  },
  setApiBaseUrl: (url) => set({ apiBaseUrl: url, lastApiTestResult: null }),
  setM3uUrl: (url) => set({ m3uUrl: url, lastM3uTestResult: null }),
  setRemoteInputEnabled: (enabled) => set({ remoteInputEnabled: enabled }),
  setVideoSource: (config) => set({ videoSource: config }),

  testApiConnection: async (customUrl?: string): Promise<ApiTestResult> => {
    const rawUrl = customUrl !== undefined ? customUrl : get().apiBaseUrl;
    const targetUrl = normalizeUrl(rawUrl);

    if (!targetUrl) {
      const res: ApiTestResult = { success: false, error: "请输入有效的服务器地址" };
      set({ lastApiTestResult: res });
      return res;
    }

    set({ isTestingApi: true, lastApiTestResult: null });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const start = performance.now();

    try {
      const response = await fetch(`${targetUrl}/api/server-config`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);
      const latency = Math.round(performance.now() - start);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const res: ApiTestResult = {
        success: true,
        siteName: data.SiteName || "OrionTV Server",
        storageType: data.StorageType || "local",
        latency,
      };
      set({ lastApiTestResult: res, isTestingApi: false });
      return res;
    } catch (e: any) {
      clearTimeout(timer);
      let errMsg = "连接失败，请检查地址或网络";
      if (e?.name === "AbortError") {
        errMsg = "连接超时 (6秒)";
      } else if (e?.message) {
        errMsg = `连接失败: ${e.message}`;
      }
      const res: ApiTestResult = { success: false, error: errMsg };
      set({ lastApiTestResult: res, isTestingApi: false });
      return res;
    }
  },

  testM3uConnection: async (customUrl?: string): Promise<M3uTestResult> => {
    const rawUrl = customUrl !== undefined ? customUrl : get().m3uUrl;
    const targetUrl = normalizeUrl(rawUrl);

    if (!targetUrl) {
      const res: M3uTestResult = { success: false, error: "请输入有效的直播源地址" };
      set({ lastM3uTestResult: res });
      return res;
    }

    set({ isTestingM3u: true, lastM3uTestResult: null });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const channels = parseM3U(text);

      if (channels.length === 0) {
        const res: M3uTestResult = { success: false, error: "解析完成，但未发现有效频道" };
        set({ lastM3uTestResult: res, isTestingM3u: false });
        return res;
      }

      const sampleChannels = channels.slice(0, 3).map((c) => c.name);
      const res: M3uTestResult = {
        success: true,
        channelCount: channels.length,
        sampleChannels,
      };
      set({ lastM3uTestResult: res, isTestingM3u: false });
      return res;
    } catch (e: any) {
      clearTimeout(timer);
      let errMsg = "无法获取或解析直播源";
      if (e?.name === "AbortError") {
        errMsg = "请求超时 (8秒)";
      } else if (e?.message) {
        errMsg = `探测失败: ${e.message}`;
      }
      const res: M3uTestResult = { success: false, error: errMsg };
      set({ lastM3uTestResult: res, isTestingM3u: false });
      return res;
    }
  },

  saveSettings: async () => {
    const { apiBaseUrl, m3uUrl, remoteInputEnabled, videoSource } = get();

    const processedApiBaseUrl = normalizeUrl(apiBaseUrl);
    const processedM3uUrl = normalizeUrl(m3uUrl);

    const oldApiBaseUrl = get().apiBaseUrl;

    await SettingsManager.save({
      apiBaseUrl: processedApiBaseUrl,
      m3uUrl: processedM3uUrl,
      remoteInputEnabled,
      videoSource,
    });

    if (oldApiBaseUrl !== processedApiBaseUrl) {
      const useAuthStore = (await import("./authStore")).default;
      await useAuthStore.getState().logout();
    }

    api.setBaseUrl(processedApiBaseUrl);
    set({
      isModalVisible: false,
      apiBaseUrl: processedApiBaseUrl,
      m3uUrl: processedM3uUrl,
    });
    if (processedApiBaseUrl) {
      await get().fetchServerConfig();
    }
  },
  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),
}));
