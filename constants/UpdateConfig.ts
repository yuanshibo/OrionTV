export const UPDATE_CONFIG = {
  // 自动检查更新
  AUTO_CHECK: true,

  // 检查更新间隔（毫秒）
  CHECK_INTERVAL: 12 * 60 * 60 * 1000, // 12小时

  // GitHub相关检查版本镜像URL列表 (官方直连与全球加速镜像自动容灾)
  get VERSION_CHECK_URLS(): string[] {
    const timestamp = Date.now();
    return [
      `https://raw.githubusercontent.com/yuanshibo/OrionTV/refs/heads/master/package.json?t=${timestamp}`,
      `https://raw.githubusercontent.com/yuanshibo/OrionTV/master/package.json?t=${timestamp}`,
      `https://cdn.jsdelivr.net/gh/yuanshibo/OrionTV@master/package.json?t=${timestamp}`,
      `https://fastly.jsdelivr.net/gh/yuanshibo/OrionTV@master/package.json?t=${timestamp}`,
      `https://ghproxy.net/https://raw.githubusercontent.com/yuanshibo/OrionTV/master/package.json?t=${timestamp}`,
    ];
  },

  // 获取平台特定的下载URL (支持多镜像加速)
  getDownloadUrls(version: string): string[] {
    const rawUrl = `https://github.com/yuanshibo/OrionTV/releases/download/v${version}/orionTV.${version}.apk`;
    return [
      `https://ghproxy.net/${rawUrl}`,
      `https://mirror.ghproxy.com/${rawUrl}`,
      rawUrl,
    ];
  },

  getDownloadUrl(version: string): string {
    return this.getDownloadUrls(version)[0];
  },

  // 是否显示更新日志
  SHOW_RELEASE_NOTES: true,

  // 是否允许跳过版本
  ALLOW_SKIP_VERSION: true,

  // 下载超时时间（毫秒）
  DOWNLOAD_TIMEOUT: 10 * 60 * 1000, // 10分钟

  // 是否在WIFI下自动下载
  AUTO_DOWNLOAD_ON_WIFI: false,

  // 更新通知设置
  NOTIFICATION: {
    ENABLED: true,
    TITLE: "OrionTV 更新",
    DOWNLOADING_TEXT: "正在下载新版本...",
    DOWNLOAD_COMPLETE_TEXT: "下载完成，点击安装",
  },
};
