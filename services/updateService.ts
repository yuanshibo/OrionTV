import ReactNativeBlobUtil from "react-native-blob-util";
import FileViewer from "react-native-file-viewer";
import { version as currentVersion } from "../package.json";

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
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/zimplexing/OrionTV/refs/heads/master/package.json"
      );

      if (!response.ok) {
        throw new Error("Failed to fetch version info");
      }

      const remotePackage = await response.json();
      const remoteVersion = remotePackage.version;

      return {
        version: remoteVersion,
        downloadUrl: `https://github.com/zimplexing/OrionTV/releases/download/v${remoteVersion}/orionTV.
${remoteVersion}.apk`,
      };
    } catch (error) {
      console.error("Error checking version:", error);
      throw error;
    }
  }

  async downloadApk(url: string, onProgress?: (progress: number) => void): Promise<string> {
    try {
      const { dirs } = ReactNativeBlobUtil.fs;
      const fileName = `OrionTV_v${new Date().getTime()}.apk`;
      const filePath = `${dirs.DownloadDir}/${fileName}`;

      const task = ReactNativeBlobUtil.config({
        fileCache: true,
        path: filePath,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          title: "OrionTV 更新下载中",
          description: "正在下载新版本...",
          mime: "application/vnd.android.package-archive",
          mediaScannable: true,
        },
      }).fetch("GET", url);

      // 监听下载进度
      if (onProgress) {
        task.progress((received: string, total: string) => {
          const receivedNum = parseInt(received, 10);
          const totalNum = parseInt(total, 10);
          const progress = Math.floor((receivedNum / totalNum) * 100);
          onProgress(progress);
        });
      }

      const res = await task;
      return res.path();
    } catch (error) {
      console.error("Error downloading APK:", error);
      throw error;
    }
  }

  async installApk(filePath: string): Promise<void> {
    try {
      await FileViewer.open(filePath, {
        showOpenWithDialog: false,
        showAppsSuggestions: false,
        displayName: "OrionTV Update",
      });
    } catch (error) {
      console.error("Error installing APK:", error);
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
