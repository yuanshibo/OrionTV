import { useEffect, useRef, useCallback } from "react";
import { useTVEventHandler, HWEvent } from "react-native";
import usePlayerStore from "@/stores/playerStore";

const INITIAL_SEEK_STEP = 20 * 1000; // 初始快进/快退时间步长(20秒)
const MAX_SEEK_STEP = 300 * 1000;    // 最大快进/快退时间步长(5分钟)
const ACCELERATION_FACTOR = 1.2;     // 加速因子(每次增加20%)
const CONTROLS_TIMEOUT = 5000;       // 定时器延迟时间(毫秒)
const FAST_SEEK_INTERVAL = 200;      // 连续快进/快退的间隔时间(毫秒)

export const useTVRemoteHandler = () => {
  const showControls = usePlayerStore((state) => state.showControls);
  const setShowControls = usePlayerStore((state) => state.setShowControls);
  const showDetails = usePlayerStore((state) => state.showDetails);
  const setShowDetails = usePlayerStore((state) => state.setShowDetails);
  const showEpisodeModal = usePlayerStore((state) => state.showEpisodeModal);
  const showRelatedVideos = usePlayerStore((state) => state.showRelatedVideos);
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const seek = usePlayerStore((state) => state.seek);

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSeekStepRef = useRef(INITIAL_SEEK_STEP);

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
    };
  }, []);

  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      // Modal/overlay guards: if any modal is open, block all other remote events.
      if (showDetails || showEpisodeModal || showRelatedVideos) {
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

        // When controls are visible, `up` and `down` should not trigger other overlays.
        if (event.eventType === 'up' || event.eventType === 'down') {
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
            setShowDetails(true);
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
              seekIntervalRef.current = setInterval(() => {
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
              seekIntervalRef.current = setInterval(() => {
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
            setShowControls(true);
            break;
        }
      }
    },
    [showControls, showDetails, showEpisodeModal, showRelatedVideos, setShowControls, resetTimer, togglePlayPause, seek, setShowDetails]
  );

  useTVEventHandler(handleTVEvent);

  const onScreenPress = () => {
    setShowControls(!showControls);
  };

  return { onScreenPress };
};
