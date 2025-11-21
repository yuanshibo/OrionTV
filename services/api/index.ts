import { ApiClient } from "./core";
import { AuthApi } from "./auth";
import { ContentApi } from "./content";
import { UserApi } from "./user";

export * from "./types";
export * from "./core";
export * from "./auth";
export * from "./content";
export * from "./user";

export const apiClient = new ApiClient();
export const authApi = new AuthApi(apiClient);
export const contentApi = new ContentApi(apiClient);
export const userApi = new UserApi(apiClient);

// Helper to update base URL on all services (via shared client)
export const setApiBaseUrl = (url: string) => {
  apiClient.setBaseUrl(url);
};
