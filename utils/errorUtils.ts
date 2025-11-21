import { isNetworkStatusZeroError } from "@/services/api";

export const NETWORK_ERROR_FRIENDLY_MESSAGE = "网络请求失败，请检查网络连接后重试";

/**
 * Maps an unknown error object to a user-friendly error message.
 * Handles network status 0 errors specifically.
 *
 * @param error The error object caught from a try-catch block.
 * @param fallback Optional fallback message if error message is empty or generic.
 * @returns A string message suitable for display to the user.
 */
export const mapErrorToMessage = (error: unknown, fallback: string = "加载失败，请重试"): string => {
  if (isNetworkStatusZeroError(error)) {
    return NETWORK_ERROR_FRIENDLY_MESSAGE;
  }

  if (!error || typeof (error as { message?: string }).message !== "string") {
    return fallback;
  }

  const message = (error as { message: string }).message;

  if (message === "API_URL_NOT_SET") {
    return "请点击右上角设置按钮，配置您的服务器地址";
  }

  if (message === "UNAUTHORIZED") {
    return "认证失败，请重新登录";
  }

  if (message.includes("Network") || message.includes("Network request failed")) {
    return "网络连接失败，请检查网络连接";
  }

  if (message.includes("timeout")) {
    return "请求超时，请检查网络或服务器状态";
  }

  if (message.includes("404")) {
    return "服务器API路径不正确，请检查服务器配置";
  }

  if (message.includes("500")) {
    return "服务器内部错误，请联系管理员";
  }

  if (message.includes("403")) {
    return "访问被拒绝，请检查权限设置";
  }

  // Return the raw message if it seems specific enough, otherwise fallback?
  // For safety, if it's short, maybe show it.
  if (message.length > 0 && message.length < 100) {
    return message;
  }

  return fallback;
};
