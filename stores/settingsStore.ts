import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SettingsManager } from "@/services/storage";
import { api, ServerConfig } from "@/services/api";
import { storageConfig } from "@/services/storageConfig";
import Logger from "@/utils/Logger";

const logger = Logger.withTag('SettingsStore');

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
  loadSettings: () => Promise<void>;
  fetchServerConfig: () => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  setM3uUrl: (url: string) => void;
  setRemoteInputEnabled: (enabled: boolean) => void;
  saveSettings: () => Promise<void>;
  setVideoSource: (config: { enabledAll: boolean; sources: { [key: string]: boolean } }) => void;
  showModal: () => void;
  hideModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiBaseUrl: "",
  m3uUrl: "",
  liveStreamSources: [],
  remoteInputEnabled: false,
  isModalVisible: false,
  serverConfig: null,
  serverConfigError: null,
  isLoadingServerConfig: false,
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
      // 在 fetchServerConfig 之前先尝试恢复 Cookie，防止第一个请求（getServerConfig）因为没带 Cookie 导致 401 被自动登出
      const authToken = await AsyncStorage.getItem('authCookies');
      if (authToken) {
        api.setCookie(authToken);
      }
      // 等待 fetchServerConfig 完成（其内部也会等待 checkLoginStatus）
      // 由此保证 Splash Screen 在认证流程完成后才隐藏
      await get().fetchServerConfig();
    } else {
      // 没有配置服务器地址，直接标记认证完成，避免 Splash 卡住
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
            // 指数退避：1s, 2s
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            logger.info(`Retrying fetchServerConfig (attempt ${attempt}/${maxRetries})...`);
          }
          const config = await api.getServerConfig();
          if (config) {
            storageConfig.setStorageType(config.StorageType);
            set({ serverConfig: config, serverConfigError: null });
            // 等待认证流程完成，确保 isAuthChecked 在 loadSettings 返回前设为 true
            const useAuthStore = (await import("./authStore")).default;
            await useAuthStore.getState().checkLoginStatus(get().apiBaseUrl);
          }
          return; // 成功，退出循环
        } catch (error) {
          lastError = error;
          logger.warn(`fetchServerConfig attempt ${attempt + 1} failed:`, error);
        }
      }
      // 所有重试失败
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
      // 无论成功或失败，都要重置加载状态
      set({ isLoadingServerConfig: false });
    }
  },
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  setM3uUrl: (url) => set({ m3uUrl: url }),
  setRemoteInputEnabled: (enabled) => set({ remoteInputEnabled: enabled }),
  setVideoSource: (config) => set({ videoSource: config }),
  saveSettings: async () => {
    const { apiBaseUrl, m3uUrl, remoteInputEnabled, videoSource } = get();

    let processedApiBaseUrl = apiBaseUrl.trim();
    if (processedApiBaseUrl.endsWith("/")) {
      processedApiBaseUrl = processedApiBaseUrl.slice(0, -1);
    }

    if (!/^https?:\/\//i.test(processedApiBaseUrl)) {
      const hostPart = processedApiBaseUrl.split("/")[0];
      // Simple check for IP address format.
      const isIpAddress = /^((\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(hostPart);
      // Check if the domain includes a port.
      const hasPort = /:\d+/.test(hostPart);

      if (isIpAddress || hasPort) {
        processedApiBaseUrl = "http://" + processedApiBaseUrl;
      } else {
        processedApiBaseUrl = "https://" + processedApiBaseUrl;
      }
    }

    // 检查地址是否变化，以决定是否清理登录态
    const oldApiBaseUrl = get().apiBaseUrl;

    await SettingsManager.save({
      apiBaseUrl: processedApiBaseUrl,
      m3uUrl,
      remoteInputEnabled,
      videoSource,
    });

    if (oldApiBaseUrl !== processedApiBaseUrl) {
      // 服务器地址变了，原本的登录态必须清除（安全且符合逻辑）
      const useAuthStore = (await import("./authStore")).default;
      await useAuthStore.getState().logout();
    }

    api.setBaseUrl(processedApiBaseUrl);
    // Also update the URL in the state so the input field shows the processed URL
    set({ isModalVisible: false, apiBaseUrl: processedApiBaseUrl });
    await get().fetchServerConfig();
  },
  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),
}));
