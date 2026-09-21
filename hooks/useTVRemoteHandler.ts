import { useEffect, useRef, useCallback } from "react";
import { useTVEventHandler, HWEvent } from "react-native";
import Toast from "react-native-toast-message";
import usePlayerStore from "@/stores/playerStore";

const INITIAL_SEEK_STEP = 20 * 1000; // 初始快进/快退时间步长(20秒)
const MAX_SEEK_STEP = 300 * 1000;    // 最大快进/快退时间步长(5分钟)
const ACCELERATION_FACTOR = 1.2;     // 加速因子(每次增加20%)
const CONTROLS_TIMEOUT = 5000;       // 定时器延迟时间(毫秒)
const FAST_SEEK_INTERVAL = 200;      // 连续快进/快退的间隔时间(毫秒)
const MAX_SEEK_DURATION = 10 * 1000; // 安全超时时间(10秒)
const LONG_SELECT_HOLD_DURATION = 1000; // 长按确认键判定延迟(结合硬件层300ms，总时长约1.3秒)
const LOCKED_TOAST_THROTTLE = 2000;  // 锁定状态下提示节流间隔(2秒)

export const useTVRemoteHandler = () => {
  const showControls = usePlayerStore((state) => state.showControls);
  const setShowControls = usePlayerStore((state) => state.setShowControls);
  const showEpisodeModal = usePlayerStore((state) => state.showEpisodeModal);
  const setShowEpisodeModal = usePlayerStore((state) => state.setShowEpisodeModal);
  const showRelatedVideos = usePlayerStore((state) => state.showRelatedVideos);
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const seek = usePlayerStore((state) => state.seek);
  const isLocked = usePlayerStore((state) => state.isLocked);
  const toggleScreenLock = usePlayerStore((state) => state.toggleScreenLock);

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSeekStepRef = useRef(INITIAL_SEEK_STEP);
  const longSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longSelectTriggeredRef = useRef(false);
  const lastLockedToastTimeRef = useRef(0);
  const lastToggleLockTimeRef = useRef(0);

  const showLockedToast = useCallback(() => {
    const now = Date.now();
    if (now - lastLockedToastTimeRef.current > LOCKED_TOAST_THROTTLE) {
      lastLockedToastTimeRef.current = now;
      Toast.show({
        type: "info",
        text1: "画面已锁定",
        text2: "长按确认键解锁",
        visibilityTime: 2000,
      });
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, CONTROLS_TIMEOUT);
  }, [setShowControls]);

  useEffect(() => {
    if (showControls) {
      resetTimer();
    } else if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }
    return () => {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, [showControls, resetTimer]);

  useEffect(() => {
    return () => {
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
      if (longSelectTimerRef.current) {
        clearTimeout(longSelectTimerRef.current);
      }
    };
  }, []);

  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      // --- Long Press OK / Select Key Handling (Lock / Unlock) ---
      if (event.eventType === 'longSelect') {
        // Key down / begin
        if (event.eventKeyAction === 0) {
          if (!longSelectTriggeredRef.current && !longSelectTimerRef.current) {
            longSelectTimerRef.current = setTimeout(() => {
              longSelectTimerRef.current = null;
              longSelectTriggeredRef.current = true;
              lastToggleLockTimeRef.current = Date.now();
              const currentLocked = usePlayerStore.getState().isLocked;
              toggleScreenLock();
              if (!currentLocked) {
                Toast.show({
                  type: "info",
                  text1: "画面已锁定",
                  text2: "长按确认键解锁",
                  visibilityTime: 2500,
                });
              } else {
                Toast.show({
                  type: "success",
                  text1: "画面已解锁",
                  text2: "遥控器按键已恢复",
                  visibilityTime: 2000,
                });
              }
            }, LONG_SELECT_HOLD_DURATION);
          }
          return;
        }

        // Key up / end
        if (event.eventKeyAction === 1) {
          if (longSelectTimerRef.current) {
            clearTimeout(longSelectTimerRef.current);
            longSelectTimerRef.current = null;
          }
          longSelectTriggeredRef.current = false;
          return;
        }

        // Fallback for single events without eventKeyAction
        if (event.eventKeyAction === undefined || event.eventKeyAction === -1) {
          const now = Date.now();
          if (now - lastToggleLockTimeRef.current < 1500) {
            return;
          }
          lastToggleLockTimeRef.current = now;
          const currentLocked = usePlayerStore.getState().isLocked;
          toggleScreenLock();
          if (!currentLocked) {
            Toast.show({
              type: "info",
              text1: "画面已锁定",
              text2: "长按确认键解锁",
              visibilityTime: 2500,
            });
          } else {
            Toast.show({
              type: "success",
              text1: "画面已解锁",
              text2: "遥控器按键已恢复",
              visibilityTime: 2000,
            });
          }
          return;
        }
      }

      // --- Screen Locked Guard: Block all other remote events ---
      if (usePlayerStore.getState().isLocked) {
        showLockedToast();
        return;
      }

      // Modal/overlay guards: if any modal is open, block all other remote events.
      if (showEpisodeModal || showRelatedVideos) {
        // We only allow the `backPress` event to be handled by the component, 
        // all other remote events are ignored.
        if (event.eventType !== 'backPress') {
          return;
        }
      }

      // Stop long-press interval on key up.
      if ((event.eventType === 'longLeft' || event.eventType === 'longRight') && event.eventKeyAction === 1) {
        if (seekIntervalRef.current) {
          clearInterval(seekIntervalRef.current);
          seekIntervalRef.current = null;
          currentSeekStepRef.current = INITIAL_SEEK_STEP; // Reset step
        }
        return;
      }

      // --- Logic when PlayerControls are VISIBLE ---
      if (showControls) {
        resetTimer();

        if (event.eventType === 'playPause') {
          togglePlayPause();
          return;
        }

        // When controls are visible, pressing UP directly switches to episode selection modal
        if (event.eventType === 'up') {
          setShowControls(false);
          setShowEpisodeModal(true);
          return;
        }

        // When controls are visible, pressing DOWN dismisses the controls overlay
        if (event.eventType === 'down') {
          setShowControls(false);
          return;
        }

        // Let `left` and `right` pass through for focus navigation within controls.
        if (event.eventType === 'left' || event.eventType === 'right') {
          return;
        }

        // --- Logic when PlayerControls are HIDDEN ---
      } else {
        switch (event.eventType) {
          case 'up':
            // UP: Directly open episode selection modal
            setShowEpisodeModal(true);
            break;
          case 'left':
          case 'longLeft':
            // Only seek immediately if not already seeking (to avoid double seek on hold start)
            // Actually, we want immediate feedback on press.
            if (!seekIntervalRef.current) {
              seek(-INITIAL_SEEK_STEP);
            }

            if (event.eventType === 'longLeft' && event.eventKeyAction === 0 && !seekIntervalRef.current) {
              currentSeekStepRef.current = INITIAL_SEEK_STEP;
              const startTime = Date.now();
              seekIntervalRef.current = setInterval(() => {
                if (Date.now() - startTime >= MAX_SEEK_DURATION) {
                  if (seekIntervalRef.current) clearInterval(seekIntervalRef.current);
                  seekIntervalRef.current = null;
                  currentSeekStepRef.current = INITIAL_SEEK_STEP;
                  return;
                }
                currentSeekStepRef.current = Math.min(currentSeekStepRef.current * ACCELERATION_FACTOR, MAX_SEEK_STEP);
                seek(-currentSeekStepRef.current);
              }, FAST_SEEK_INTERVAL);
            }
            break;
          case 'right':
          case 'longRight':
            if (!seekIntervalRef.current) {
              seek(INITIAL_SEEK_STEP);
            }

            if (event.eventType === 'longRight' && event.eventKeyAction === 0 && !seekIntervalRef.current) {
              currentSeekStepRef.current = INITIAL_SEEK_STEP;
              const startTime = Date.now();
              seekIntervalRef.current = setInterval(() => {
                if (Date.now() - startTime >= MAX_SEEK_DURATION) {
                  if (seekIntervalRef.current) clearInterval(seekIntervalRef.current);
                  seekIntervalRef.current = null;
                  currentSeekStepRef.current = INITIAL_SEEK_STEP;
                  return;
                }
                currentSeekStepRef.current = Math.min(currentSeekStepRef.current * ACCELERATION_FACTOR, MAX_SEEK_STEP);
                seek(currentSeekStepRef.current);
              }, FAST_SEEK_INTERVAL);
            }
            break;
          case 'select':
          case 'playPause':
            togglePlayPause();
            break;
          case 'down':
            // DOWN: Show player controls
            setShowControls(true);
            break;
        }
      }
    },
    [showControls, showEpisodeModal, showRelatedVideos, isLocked, setShowControls, setShowEpisodeModal, resetTimer, togglePlayPause, seek, toggleScreenLock, showLockedToast]
  );

  useTVEventHandler(handleTVEvent);

  const onScreenPress = () => {
    if (usePlayerStore.getState().isLocked) {
      showLockedToast();
      return;
    }
    setShowControls(!showControls);
  };

  return { onScreenPress };
};
