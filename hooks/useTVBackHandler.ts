import { useCallback, useRef } from "react";
import { BackHandler } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Toast from "react-native-toast-message";

export interface TVBackHandlerOptions {
  /** Custom handler executed before default navigation. If returns true, event is consumed. */
  onBackPress?: () => boolean | void;
  /** Whether to enable double-press to exit (used primarily on home screen). Defaults to false. */
  doublePressToExit?: boolean;
  /** Exit prompt message for double-press */
  exitToastMessage?: string;
  /** Fallback route if cannot go back. Defaults to '/' */
  fallbackRoute?: string;
  /** Whether the handler is currently active. Defaults to true */
  enabled?: boolean;
}

export function useTVBackHandler(options: TVBackHandlerOptions = {}) {
  const {
    onBackPress,
    doublePressToExit = false,
    exitToastMessage = "再按一次退出应用",
    fallbackRoute = "/",
    enabled = true,
  } = options;

  const router = useRouter();
  const lastBackPressTimeRef = useRef<number>(0);
  const onBackPressRef = useRef(onBackPress);
  onBackPressRef.current = onBackPress;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        // 1. If custom onBackPress provided, execute it first
        if (onBackPressRef.current) {
          const handled = onBackPressRef.current();
          if (handled === true) {
            return true;
          }
        }

        // 2. Double-press to exit pattern (for root screen)
        if (doublePressToExit) {
          const now = Date.now();
          if (now - lastBackPressTimeRef.current < 2000) {
            BackHandler.exitApp();
            return true;
          }

          lastBackPressTimeRef.current = now;
          Toast.show({
            type: "info",
            text1: exitToastMessage,
            visibilityTime: 2000,
          });
          return true;
        }

        // 3. Default stack back navigation
        if (router.canGoBack()) {
          router.back();
          return true;
        } else if (fallbackRoute) {
          router.replace(fallbackRoute as any);
          return true;
        }

        return false;
      });

      return () => {
        subscription.remove();
      };
    }, [enabled, doublePressToExit, exitToastMessage, fallbackRoute, router])
  );
}

