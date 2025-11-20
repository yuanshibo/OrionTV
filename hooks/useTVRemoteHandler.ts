import { useEffect, useRef, useCallback } from "react";
import { useTVEventHandler, HWEvent } from "react-native";
import usePlayerStore from "@/stores/playerStore";
import usePlayerUIStore from "@/stores/playerUIStore";

const SEEK_STEP = 20 * 1000; // 20 seconds
const FAST_SEEK_INTERVAL = 200; // 200ms

// Acceleration: Increase seek step based on duration of hold
const ACCELERATION_DELAY = 1000; // 1 second before acceleration starts
const ACCELERATED_SEEK_STEP = 60 * 1000; // 60 seconds

export const useTVRemoteHandler = () => {
  // UI Store
  const showControls = usePlayerUIStore((state) => state.showControls);
  const setShowControls = usePlayerUIStore((state) => state.setShowControls);
  const showDetails = usePlayerUIStore((state) => state.showDetails);
  const setShowDetails = usePlayerUIStore((state) => state.setShowDetails);
  const showEpisodeModal = usePlayerUIStore((state) => state.showEpisodeModal);
  const showRelatedVideos = usePlayerUIStore((state) => state.showRelatedVideos);
  const showSourceModal = usePlayerUIStore((state) => state.showSourceModal);
  const showSpeedModal = usePlayerUIStore((state) => state.showSpeedModal);

  // Player Store
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const seek = usePlayerStore((state) => state.seek);

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekStartTimeRef = useRef<number>(0);

  const resetTimer = useCallback(() => {
    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, CONTROLS_TIMEOUT);
  }, [setShowControls]);

  const CONTROLS_TIMEOUT = 5000;

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
      if (showDetails || showEpisodeModal || showRelatedVideos || showSourceModal || showSpeedModal) {
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
          seekStartTimeRef.current = 0;
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
            // Initial seek
            if (!seekIntervalRef.current) {
                seek(-SEEK_STEP);
            }

            if (event.eventType === 'longLeft' && event.eventKeyAction === 0 && !seekIntervalRef.current) {
              seekStartTimeRef.current = Date.now();
              seekIntervalRef.current = setInterval(() => {
                const duration = Date.now() - seekStartTimeRef.current;
                const step = duration > ACCELERATION_DELAY ? ACCELERATED_SEEK_STEP : SEEK_STEP;
                seek(-step);
              }, FAST_SEEK_INTERVAL);
            }
            break;
          case 'right':
          case 'longRight':
             // Initial seek
             if (!seekIntervalRef.current) {
                seek(SEEK_STEP);
            }

            if (event.eventType === 'longRight' && event.eventKeyAction === 0 && !seekIntervalRef.current) {
              seekStartTimeRef.current = Date.now();
              seekIntervalRef.current = setInterval(() => {
                const duration = Date.now() - seekStartTimeRef.current;
                const step = duration > ACCELERATION_DELAY ? ACCELERATED_SEEK_STEP : SEEK_STEP;
                seek(step);
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
    [showControls, showDetails, showEpisodeModal, showRelatedVideos, showSourceModal, showSpeedModal, setShowControls, resetTimer, togglePlayPause, seek, setShowDetails]
  );

  useTVEventHandler(handleTVEvent);

  const onScreenPress = () => {
    setShowControls(!showControls);
  };

  return { onScreenPress };
};
