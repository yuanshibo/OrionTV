import { useCallback, useRef } from 'react';
import { useWindowDimensions, GestureResponderEvent } from 'react-native';
import { useTVRemoteHandler } from './useTVRemoteHandler';
import usePlayerUIStore from '@/stores/playerUIStore';
import usePlayerStore from '@/stores/playerStore';

/**
 * A hook to centralize player interaction logic based on device type.
 * It abstracts away the differences between TV remote and mobile touch controls.
 * 
 * @param deviceType The type of the device, e.g., 'tv', 'mobile'.
 * @returns An object containing interaction handlers, like `onScreenPress`.
 */
export function usePlayerInteractions(deviceType: string) {
  const tvRemoteHandler = useTVRemoteHandler();
  const { width } = useWindowDimensions();

  // Store selectors
  const showControls = usePlayerUIStore((state) => state.showControls);
  const setShowControls = usePlayerUIStore((state) => state.setShowControls);
  const seek = usePlayerStore((state) => state.seek);

  const lastTapTimeRef = useRef(0);

  /**
   * Handles the primary screen press action.
   * On TV, it triggers the remote handler to show controls.
   * On Mobile/Tablet, it handles single tap (toggle controls) and double tap (seek).
   */
  const onScreenPress = useCallback((event?: GestureResponderEvent) => {
    if (deviceType === 'tv') {
      tvRemoteHandler.onScreenPress();
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
      // Double Tap Detected
      if (event) {
        const x = event.nativeEvent.pageX;
        if (x < width * 0.35) {
          seek(-10000); // Rewind 10s
        } else if (x > width * 0.65) {
          seek(10000); // Forward 10s
        } else {
          // Double tap center: Toggle Play/Pause or just let it toggle controls again
          // For now, do nothing special, let standard logic proceed (which toggles controls)
          // But since single tap toggled controls, double tap toggles them back.
          setShowControls(!showControls);
        }
      }
      lastTapTimeRef.current = 0;
    } else {
      // Single Tap
      lastTapTimeRef.current = now;
      setShowControls(!showControls);
    }
  }, [deviceType, tvRemoteHandler, showControls, setShowControls, width, seek]);

  return { onScreenPress };
}
