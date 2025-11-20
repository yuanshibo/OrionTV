import { useCallback } from 'react';
import { useTVRemoteHandler } from './useTVRemoteHandler';
import usePlayerUIStore from '@/stores/playerUIStore';

/**
 * A hook to centralize player interaction logic based on device type.
 * It abstracts away the differences between TV remote and mobile touch controls.
 * 
 * @param deviceType The type of the device, e.g., 'tv', 'mobile'.
 * @returns An object containing interaction handlers, like `onScreenPress`.
 */
export function usePlayerInteractions(deviceType: string) {
  const tvRemoteHandler = useTVRemoteHandler();
  // By selecting state properties individually, we prevent unnecessary re-renders
  // and avoid the infinite loop issue caused by creating a new object on every render.
  const showControls = usePlayerUIStore((state) => state.showControls);
  const setShowControls = usePlayerUIStore((state) => state.setShowControls);

  /**
   * Handles the primary screen press action.
   * On TV, it triggers the remote handler to show controls.
   * On Mobile/Tablet, it toggles the visibility of the controls.
   */
  const onScreenPress = useCallback(() => {
    if (deviceType === 'tv') {
      tvRemoteHandler.onScreenPress();
    } else {
      setShowControls(!showControls);
    }
  }, [deviceType, tvRemoteHandler, showControls, setShowControls]);

  // This hook can be expanded in the future for more complex interactions
  // e.g., double-tap to seek, etc.

  return { onScreenPress };
}
