import { useMemo } from "react";
import { api } from "@/services/api";
import useAuthStore from "@/stores/authStore";

export interface ImageSourceOptions {
  width?: number;
  useProxy?: boolean;
}

/**
 * useImageSource
 *
 * Custom hook to generate memoized image source objects with authentication cookies
 * and image proxy resolution. Prevents unnecessary object allocations during list renders.
 */
export function useImageSource(uri?: string | null, options: ImageSourceOptions = {}) {
  const { width = 200, useProxy = true } = options;
  const authCookie = useAuthStore((state) => state.authCookie);

  return useMemo(() => {
    if (!uri) return undefined;
    const finalUri = useProxy ? api.getImageProxyUrl(uri) : uri;
    return {
      uri: finalUri,
      headers: authCookie ? { Cookie: authCookie } : undefined,
      width,
    };
  }, [uri, useProxy, authCookie, width]);
}
