import { renderHook, act } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { HWEvent } from 'react-native';
import { useTVRemoteHandler } from '../useTVRemoteHandler';
import usePlayerStore from '@/stores/playerStore';

let tvEventHandlerCallback: ((event: HWEvent) => void) | null = null;

describe('useTVRemoteHandler - Screen Lock / Child Lock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    act(() => {
      usePlayerStore.getState().reset();
      usePlayerStore.setState({ isLocked: false, showControls: false });
    });
    tvEventHandlerCallback = null;
    jest.spyOn(ReactNative.TVEventHandler, 'addListener').mockImplementation((cb: any) => {
      tvEventHandlerCallback = cb;
      return { remove: jest.fn() } as any;
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('toggles playPause on select when unlocked', () => {
    const togglePlayPauseSpy = jest.spyOn(usePlayerStore.getState(), 'togglePlayPause');
    renderHook(() => useTVRemoteHandler());

    expect(tvEventHandlerCallback).not.toBeNull();

    act(() => {
      tvEventHandlerCallback!({ eventType: 'select' });
    });

    expect(togglePlayPauseSpy).toHaveBeenCalled();
  });

  it('cancels lock if longSelect is released before hold duration', () => {
    renderHook(() => useTVRemoteHandler());

    expect(usePlayerStore.getState().isLocked).toBe(false);

    // Key down longSelect
    act(() => {
      tvEventHandlerCallback!({ eventType: 'longSelect', eventKeyAction: 0 });
    });

    // Advance only 500ms (threshold is 1000ms)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Key up longSelect
    act(() => {
      tvEventHandlerCallback!({ eventType: 'longSelect', eventKeyAction: 1 });
    });

    // Advance remaining time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(usePlayerStore.getState().isLocked).toBe(false);
  });

  it('locks the screen when longSelect is held for full duration', () => {
    renderHook(() => useTVRemoteHandler());

    expect(usePlayerStore.getState().isLocked).toBe(false);

    // Key down longSelect
    act(() => {
      tvEventHandlerCallback!({ eventType: 'longSelect', eventKeyAction: 0 });
    });

    // Advance 1000ms
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(usePlayerStore.getState().isLocked).toBe(true);

    // Key up longSelect
    act(() => {
      tvEventHandlerCallback!({ eventType: 'longSelect', eventKeyAction: 1 });
    });

    expect(usePlayerStore.getState().isLocked).toBe(true);
  });

  it('blocks all other remote events and onScreenPress when locked', () => {
    const togglePlayPauseSpy = jest.spyOn(usePlayerStore.getState(), 'togglePlayPause');
    const seekSpy = jest.spyOn(usePlayerStore.getState(), 'seek');
    const setShowControlsSpy = jest.spyOn(usePlayerStore.getState(), 'setShowControls');

    const { result } = renderHook(() => useTVRemoteHandler());

    // Lock screen
    act(() => {
      usePlayerStore.setState({ isLocked: true });
    });

    // Press select
    act(() => {
      tvEventHandlerCallback!({ eventType: 'select' });
    });
    expect(togglePlayPauseSpy).not.toHaveBeenCalled();

    // Press playPause
    act(() => {
      tvEventHandlerCallback!({ eventType: 'playPause' });
    });
    expect(togglePlayPauseSpy).not.toHaveBeenCalled();

    // Press left / right
    act(() => {
      tvEventHandlerCallback!({ eventType: 'left' });
      tvEventHandlerCallback!({ eventType: 'right' });
    });
    expect(seekSpy).not.toHaveBeenCalled();

    // Press down
    act(() => {
      tvEventHandlerCallback!({ eventType: 'down' });
    });
    expect(setShowControlsSpy).not.toHaveBeenCalled();

    // Screen press
    act(() => {
      result.current.onScreenPress();
    });
    expect(usePlayerStore.getState().showControls).toBe(false);
  });

  it('unlocks screen when longSelect is held again', () => {
    renderHook(() => useTVRemoteHandler());

    act(() => {
      usePlayerStore.setState({ isLocked: true });
    });
    expect(usePlayerStore.getState().isLocked).toBe(true);

    // Key down longSelect while locked
    act(() => {
      tvEventHandlerCallback!({ eventType: 'longSelect', eventKeyAction: 0 });
    });

    // Advance 1000ms
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(usePlayerStore.getState().isLocked).toBe(false);

    // Key up longSelect
    act(() => {
      tvEventHandlerCallback!({ eventType: 'longSelect', eventKeyAction: 1 });
    });

    // Now events work again
    const togglePlayPauseSpy = jest.spyOn(usePlayerStore.getState(), 'togglePlayPause');
    act(() => {
      tvEventHandlerCallback!({ eventType: 'select' });
    });
    expect(togglePlayPauseSpy).toHaveBeenCalled();
  });
});
