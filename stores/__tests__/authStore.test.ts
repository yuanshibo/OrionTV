import useAuthStore from '../authStore';
import { useSettingsStore } from '../settingsStore';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    getServerConfig: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Logger to avoid console spam
jest.mock('@/utils/Logger', () => ({
  withTag: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('authStore Integration with settingsStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isLoggedIn: false,
      authCookie: null,
      isLoginModalVisible: false,
    });
    useSettingsStore.setState({
      serverConfig: null,
      serverConfigError: null,
      isLoadingServerConfig: false,
    });
    jest.clearAllMocks();
  });

  it('should show login modal when getServerConfig throws UNAUTHORIZED', async () => {
    // 1. Setup api mock to reject with UNAUTHORIZED
    const error = new Error("UNAUTHORIZED");
    (api.getServerConfig as jest.Mock).mockRejectedValue(error);

    // 2. Trigger fetchServerConfig via settingsStore
    // This simulates what happens when settings are loaded or saved
    await useSettingsStore.getState().fetchServerConfig();

    // Verify settingsStore state
    const settingsState = useSettingsStore.getState();
    expect(settingsState.serverConfig).toBeNull();
    expect(settingsState.serverConfigError).toEqual(error);

    // 3. Trigger checkLoginStatus via authStore
    // This simulates App initialization or update
    await useAuthStore.getState().checkLoginStatus('http://test.com');

    // Verify authStore state
    const authState = useAuthStore.getState();
    expect(authState.isLoginModalVisible).toBe(true);
    expect(authState.isLoggedIn).toBe(false);
  });

  it('should NOT show login modal when getServerConfig fails with Network Error', async () => {
    // 1. Setup api mock to reject with Network Error
    const error = new Error("Network Error");
    (api.getServerConfig as jest.Mock).mockRejectedValue(error);

    // 2. Trigger fetchServerConfig
    await useSettingsStore.getState().fetchServerConfig();

    // Verify settingsStore state
    const settingsState = useSettingsStore.getState();
    expect(settingsState.serverConfigError).toEqual(error);

    // 3. Trigger checkLoginStatus
    await useAuthStore.getState().checkLoginStatus('http://test.com');

    // Verify authStore state
    const authState = useAuthStore.getState();
    expect(authState.isLoginModalVisible).toBe(false);
  });
});
