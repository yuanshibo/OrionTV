import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { useTVRemoteHandler } from './useTVRemoteHandler';
import usePlayerStore from '@/stores/playerStore';

/**
 * A hook to centralize player interaction logic based on device type.
 * It abstracts away the differences between TV remote and mobile touch controls.
 * 
 * @param deviceType The type of the device, e.g., 'tv', 'mobile'.
 * @returns An object containing interaction handlers, like `onScreenPress` and `onScreenLongPress`.
 */
export function usePlayerInteractions(deviceType: string) {
  const tvRemoteHandler = useTVRemoteHandler();
  const showControls = usePlayerStore((state) => state.showControls);
  const setShowControls = usePlayerStore((state) => state.setShowControls);
  const isLocked = usePlayerStore((state) => state.isLocked);
  const toggleScreenLock = usePlayerStore((state) => state.toggleScreenLock);

  /**
   * Handles the primary screen press action.
   * On TV, it triggers the remote handler to show controls.
   * On Mobile/Tablet, it toggles the visibility of the controls.
   */
  const onScreenPress = useCallback(() => {
    if (isLocked) {
      Toast.show({
        type: "info",
        text1: "画面已锁定",
        text2: "长按确认键解锁",
        visibilityTime: 2000,
      });
      return;
    }

    if (deviceType === 'tv') {
      tvRemoteHandler.onScreenPress();
    } else {
      setShowControls(!showControls);
    }
  }, [deviceType, tvRemoteHandler, showControls, setShowControls, isLocked]);

  const onScreenLongPress = useCallback(() => {
    const willLock = !isLocked;
    toggleScreenLock();
    if (willLock) {
      Toast.show({
        type: "info",
        text1: "画面已锁定",
        text2: deviceType === 'tv' ? "长按确认键解锁" : "长按屏幕解锁",
        visibilityTime: 2500,
      });
    } else {
      Toast.show({
        type: "success",
        text1: "画面已解锁",
        visibilityTime: 2000,
      });
    }
  }, [isLocked, toggleScreenLock, deviceType]);

  return { onScreenPress, onScreenLongPress };
}
