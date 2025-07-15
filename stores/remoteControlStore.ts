import { create } from 'zustand';
import { remoteControlService } from '@/services/remoteControlService';

interface RemoteControlState {
  isServerRunning: boolean;
  serverUrl: string | null;
  error: string | null;
  startServer: () => Promise<void>;
  stopServer: () => void;
  isModalVisible: boolean;
  showModal: () => void;
  hideModal: () => void;
  lastMessage: string | null;
  setMessage: (message: string) => void;
}

export const useRemoteControlStore = create<RemoteControlState>((set, get) => ({
  isServerRunning: false,
  serverUrl: null,
  error: null,
  isModalVisible: false,
  lastMessage: null,

  startServer: async () => {
    if (get().isServerRunning) {
      return;
    }
    remoteControlService.init({
      onMessage: (message: string) => {
        console.log('[RemoteControlStore] Received message:', message);
        set({ lastMessage: message });
      },
      onHandshake: () => {
        console.log('[RemoteControlStore] Handshake successful');
        set({ isModalVisible: false })
      },
    });
    try {
      const url = await remoteControlService.startServer();
      console.log(`[RemoteControlStore] Server started, URL: ${url}`);
      set({ isServerRunning: true, serverUrl: url, error: null });
    } catch {
      const errorMessage = '启动失败，请强制退应用后重试。';
      console.info('[RemoteControlStore] Failed to start server:', errorMessage);
      set({ error: errorMessage });
    }
  },

  stopServer: () => {
    if (get().isServerRunning) {
      remoteControlService.stopServer();
      set({ isServerRunning: false, serverUrl: null });
    }
  },

  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),

  setMessage: (message: string) => {
    set({ lastMessage: `${message}_${Date.now()}` });
  },
}));