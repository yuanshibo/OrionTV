import { useSettingsStore } from '@/stores/settingsStore';

export interface ApiConfigStatus {
  isConfigured: boolean;
  isValidating: boolean;
  isValid: boolean | null;
  error: string | null;
  needsConfiguration: boolean;
}

export const useApiConfig = () => {
  const { apiBaseUrl, serverConfig, isLoadingServerConfig, serverConfigError } = useSettingsStore();

  const isConfigured = Boolean(apiBaseUrl && apiBaseUrl.trim());
  const needsConfiguration = !isConfigured;

  let isValidating = false;
  let isValid: boolean | null = null;
  let error: string | null = null;

  if (isConfigured) {
    if (isLoadingServerConfig) {
      isValidating = true;
      isValid = null;
      error = null;
    } else {
      isValidating = false;
      if (serverConfig) {
        isValid = true;
        error = null;
      } else {
        isValid = false;
        error = serverConfigError || '无法获取服务器配置';
      }
    }
  } else {
    isValidating = false;
    isValid = false;
    error = null;
  }

  const status: ApiConfigStatus = {
    isConfigured,
    isValidating,
    isValid,
    error,
    needsConfiguration,
  };

  return status;
};

export const getApiConfigErrorMessage = (status: ApiConfigStatus): string => {
  if (status.needsConfiguration) {
    return '请点击右上角设置按钮，配置您的服务器地址';
  }
  
  if (status.error) {
    return status.error;
  }
  
  if (status.isValidating) {
    return '正在验证服务器配置...';
  }
  
  if (status.isValid === false) {
    return '服务器配置验证失败，请检查设置';
  }
  
  return '加载失败，请重试';
};