export interface PlayerSettings {
  introEndTime?: number;
  outroStartTime?: number;
  playbackRate?: number;
}

export interface AppSettings {
  apiBaseUrl: string;
  remoteInputEnabled: boolean;
  videoSource: {
    enabledAll: boolean;
    sources: {
      [key: string]: boolean;
    };
  };
  adBlockMode?: "seamless" | "skip" | "off";
}

export interface ServerConfig {
  SiteName: string;
  StorageType: "localstorage" | "redis" | string;
}

export type ApiConfigStatus = "valid" | "unconfigured" | "invalid";
