import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiClient } from "./core";
import { ServerConfig } from "./types";

export class AuthApi {
  constructor(private client: ApiClient) {}

  async login(username?: string | undefined, password?: string): Promise<{ ok: boolean }> {
    const response = await this.client.fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    // 存储cookie到AsyncStorage
    const cookies = response.headers.get("Set-Cookie");
    if (cookies) {
      await AsyncStorage.setItem("authCookies", cookies);
    }

    return response.json();
  }

  async logout(): Promise<{ ok: boolean }> {
    const response = await this.client.fetch("/api/logout", {
      method: "POST",
    });
    await AsyncStorage.setItem("authCookies", '');
    return response.json();
  }

  async getServerConfig(): Promise<ServerConfig> {
    const response = await this.client.fetch("/api/server-config");
    return response.json();
  }
}
