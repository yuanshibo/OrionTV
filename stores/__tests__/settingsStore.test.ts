import { useSettingsStore } from '../settingsStore';
import { SettingsManager } from '@/services/storage';

jest.mock('@/services/api', () => ({
  api: {
    setBaseUrl: jest.fn(),
    setCookie: jest.fn(),
    getServerConfig: jest.fn().mockResolvedValue({ SiteName: 'TestSite', StorageType: 'localstorage' }),
  },
}));

describe('settingsStore - adBlockMode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      adBlockMode: 'seamless',
    });
  });

  it('defaults adBlockMode to seamless', () => {
    expect(useSettingsStore.getState().adBlockMode).toBe('seamless');
  });

  it('updates adBlockMode and auto-saves to storage when setAdBlockMode is called', async () => {
    const saveSpy = jest.spyOn(SettingsManager, 'save').mockResolvedValue(undefined);

    useSettingsStore.getState().setAdBlockMode('skip');
    expect(useSettingsStore.getState().adBlockMode).toBe('skip');
    expect(saveSpy).toHaveBeenCalledWith({ adBlockMode: 'skip' });

    useSettingsStore.getState().setAdBlockMode('off');
    expect(useSettingsStore.getState().adBlockMode).toBe('off');
    expect(saveSpy).toHaveBeenCalledWith({ adBlockMode: 'off' });

    saveSpy.mockRestore();
  });

  it('loads saved adBlockMode from SettingsManager during loadSettings', async () => {
    const getSpy = jest.spyOn(SettingsManager, 'get').mockResolvedValue({
      apiBaseUrl: 'http://test.com',
      remoteInputEnabled: false,
      videoSource: { enabledAll: true, sources: {} },
      m3uUrl: '',
      adBlockMode: 'skip',
    });

    await useSettingsStore.getState().loadSettings();

    expect(useSettingsStore.getState().adBlockMode).toBe('skip');

    getSpy.mockRestore();
  });
});
