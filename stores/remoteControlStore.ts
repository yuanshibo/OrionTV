import { create } from 'zustand';
import { remoteControlService } from '@/services/remoteControlService';
import Logger from '@/utils/Logger';

const logger = Logger.withTag('RemoteControlStore');

interface RemoteControlState {
  isServerRunning: boolean;
  serverUrl: string | null;
  error: string | null;
  startServer: () => Promise<void>;
  stopServer: () => void;
  isModalVisible: boolean;
  showModal: (targetPage?: string) => void;
  hideModal: () => void;
  lastMessage: string | null;
  targetPage: string | null;
  setMessage: (message: string, targetPage?: string) => void;
  clearMessage: () => void;
}

export const useRemoteControlStore = create<RemoteControlState>((set, get) => ({
  isServerRunning: false,
  serverUrl: null,
  error: null,
  isModalVisible: false,
  lastMessage: null,
  targetPage: null,

  startServer: async () => {
    // 检查底层服务的真实状态（而非 Zustand 内存标志）
    // 避免从后台恢复时因 Zustand 状态被重置但 TCP 端口仍占用引发 EADDRINUSE
    if (remoteControlService.isRunning()) {
      // 服务实际上还在运行，同步 Zustand 状态即可，无需重启
      set({ isServerRunning: true });
      return;
    }
    remoteControlService.init({
      onMessage: (message: string) => {
        logger.debug('Received message:', message);
        const currentState = get();
        set({ lastMessage: message, targetPage: currentState.targetPage });
      },
      onHandshake: () => {
        logger.debug('Handshake successful');
        set({ isModalVisible: false })
      },
    });
    try {
      const url = await remoteControlService.startServer();
      logger.info('Server started, URL:', url);
      set({ isServerRunning: true, serverUrl: url, error: null });
    } catch (error) {
      // EADDRINUSE: 端口已被占用，尝试停止旧实例后重试一次
      logger.warn('Failed to start server, trying to stop and restart:', error);
      try {
        remoteControlService.stopServer();
        const url = await remoteControlService.startServer();
        logger.info('Server restarted successfully, URL:', url);
        set({ isServerRunning: true, serverUrl: url, error: null });
      } catch (retryError) {
        const errorMessage = '启动失败，请强制退应用后重试。';
        logger.error('Failed to start server:', errorMessage);
        set({ isServerRunning: false, error: errorMessage });
      }
    }
  },

  stopServer: () => {
    if (get().isServerRunning) {
      remoteControlService.stopServer();
      set({ isServerRunning: false, serverUrl: null });
    }
  },

  showModal: (targetPage?: string) => set({ isModalVisible: true, targetPage }),
  hideModal: () => set({ isModalVisible: false, targetPage: null }),

  setMessage: (message: string, targetPage?: string) => {
    set({ lastMessage: `${message}_${Date.now()}`, targetPage });
  },

  clearMessage: () => {
    set({ lastMessage: null, targetPage: null });
  },
}));