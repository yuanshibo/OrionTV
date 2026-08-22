import ReactNativeBlobUtil from "react-native-blob-util";
import FileViewer from "react-native-file-viewer";
import Toast from "react-native-toast-message";
import { version as currentVersion } from "../package.json";
import { UPDATE_CONFIG } from "../constants/UpdateConfig";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('UpdateService');

interface VersionInfo {
  version: string;
  downloadUrl: string;
}

class UpdateService {
  private static instance: UpdateService;

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  async checkVersion(): Promise<VersionInfo> {
    const urls = UPDATE_CONFIG.VERSION_CHECK_URLS;
    let lastError: unknown;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

      try {
        logger.debug(`Checking version against mirror (${i + 1}/${urls.length}): ${url.split('?')[0]}`);
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android TV; OrionTV)",
            "Cache-Control": "no-cache",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const remotePackage = await response.json();
        const remoteVersion = remotePackage?.version;

        if (!remoteVersion) {
          throw new Error("Invalid package.json format");
        }

        logger.info(`Successfully fetched version info: v${remoteVersion} from mirror ${i + 1}`);

        return {
          version: remoteVersion,
          downloadUrl: UPDATE_CONFIG.getDownloadUrl(remoteVersion),
        };
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        logger.info(`Version check mirror ${i + 1} failed: ${error}`);
      }
    }

    logger.warn("All update check mirrors failed:", lastError);
    Toast.show({ type: "error", text1: "检查更新失败", text2: "无法获取版本信息，请检查网络连接" });
    throw new Error("无法连接到更新服务器，请检查网络连接");
  }

  // 清理旧的APK文件
  private async cleanOldApkFiles(): Promise<void> {
    try {
      const { dirs } = ReactNativeBlobUtil.fs;
      // 使用DocumentDir而不是DownloadDir
      const files = await ReactNativeBlobUtil.fs.ls(dirs.DocumentDir);
      
      // 查找所有OrionTV APK文件
      const apkFiles = files.filter(file => file.startsWith('OrionTV_v') && file.endsWith('.apk'));
      
      // 保留最新的2个文件，删除其他的
      if (apkFiles.length > 2) {
        const sortedFiles = apkFiles.sort((a, b) => {
          // 从文件名中提取时间戳进行排序
          const timeA = a.match(/OrionTV_v(\d+)\.apk/)?.[1] || '0';
          const timeB = b.match(/OrionTV_v(\d+)\.apk/)?.[1] || '0';
          return parseInt(timeB) - parseInt(timeA);
        });
        
        // 删除旧文件
        const filesToDelete = sortedFiles.slice(2);
        for (const file of filesToDelete) {
          try {
            await ReactNativeBlobUtil.fs.unlink(`${dirs.DocumentDir}/${file}`);
            logger.debug(`Cleaned old APK file: ${file}`);
          } catch (deleteError) {
            logger.warn(`Failed to delete old APK file ${file}:`, deleteError);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to clean old APK files:', error);
    }
  }

  async downloadApk(url: string, onProgress?: (progress: number) => void): Promise<string> {
    // 清理旧文件
    await this.cleanOldApkFiles();

    const versionMatch = url.match(/v(\d+\.\d+\.\d+)/);
    const candidates = versionMatch ? UPDATE_CONFIG.getDownloadUrls(versionMatch[1]) : [url];
    let lastError: unknown;

    for (let i = 0; i < candidates.length; i++) {
      const downloadTarget = candidates[i];
      try {
        logger.info(`Attempting APK download from (${i + 1}/${candidates.length}): ${downloadTarget}`);
        const { dirs } = ReactNativeBlobUtil.fs;
        const timestamp = new Date().getTime();
        const fileName = `OrionTV_v${timestamp}.apk`;
        const filePath = `${dirs.DocumentDir}/${fileName}`;

        const task = ReactNativeBlobUtil.config({
          fileCache: true,
          path: filePath,
          timeout: UPDATE_CONFIG.DOWNLOAD_TIMEOUT,
        }).fetch("GET", downloadTarget);

        if (onProgress) {
          task.progress((received: string, total: string) => {
            const receivedNum = parseInt(received, 10);
            const totalNum = parseInt(total, 10);
            if (totalNum > 0) {
              const progress = Math.floor((receivedNum / totalNum) * 100);
              onProgress(progress);
            }
          });
        }

        const res = await task;
        logger.debug(`APK downloaded successfully: ${filePath}`);
        return res.path();
      } catch (error) {
        lastError = error;
        logger.warn(`Download candidate ${i + 1} failed:`, error);
      }
    }

    Toast.show({ type: "error", text1: "下载失败", text2: "APK下载失败，请检查网络连接" });
    throw new Error(`Download failed after all mirror attempts: ${lastError}`);
  }

  async installApk(filePath: string): Promise<void> {
    try {
      // 首先检查文件是否存在
      const exists = await ReactNativeBlobUtil.fs.exists(filePath);
      if (!exists) {
        throw new Error(`APK file not found: ${filePath}`);
      }

      // 使用FileViewer打开APK文件进行安装
      // 这会触发Android的包安装器
      await FileViewer.open(filePath, {
        showOpenWithDialog: true, // 显示选择应用对话框
        showAppsSuggestions: true, // 显示应用建议
        displayName: "OrionTV Update",
      });
    } catch (error) {
      logger.info("Error installing APK:", error);
      
      // 提供更详细的错误信息
      if (error instanceof Error) {
        if (error.message.includes('No app found')) {
          Toast.show({ type: "error", text1: "安装失败", text2: "未找到可安装APK的应用，请确保允许安装未知来源的应用" });
          throw new Error('未找到可安装APK的应用，请确保允许安装未知来源的应用');
        } else if (error.message.includes('permission')) {
          Toast.show({ type: "error", text1: "安装失败", text2: "没有安装权限，请在设置中允许此应用安装未知来源的应用" });
          throw new Error('没有安装权限，请在设置中允许此应用安装未知来源的应用');
        } else {
          Toast.show({ type: "error", text1: "安装失败", text2: "APK安装过程中出现错误" });
        }
      } else {
        Toast.show({ type: "error", text1: "安装失败", text2: "APK安装过程中出现未知错误" });
      }
      
      throw error;
    }
  }

  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  getCurrentVersion(): string {
    return currentVersion;
  }

  isUpdateAvailable(remoteVersion: string): boolean {
    return this.compareVersions(remoteVersion, currentVersion) > 0;
  }
}

export default UpdateService.getInstance();
