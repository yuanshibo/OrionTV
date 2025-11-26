import { RefObject } from 'react';
import { FocusPriority } from '@/types/focus';

/**
 * Type definition for a focusable target.
 * Can be a React RefObject or a direct component instance.
 */
type TVFocusTarget = RefObject<any> | { setNativeProps: (props: object) => void } | null | undefined;

/**
 * Options for requestTVFocus function
 */
interface RequestFocusOptions {
  /** Duration in ms to hold the preferred focus state before resetting (default 300ms) */
  duration?: number;

  /** Priority level for this focus request */
  priority?: FocusPriority;

  /** Callback invoked when focus is successfully acquired */
  onFocusAcquired?: () => void;

  /** Callback invoked if focus request is denied due to lower priority */
  onFocusDenied?: () => void;
}

// Track current focus priority globally
let currentGlobalPriority: FocusPriority = FocusPriority.DEFAULT;

/**
 * Utility to programmatically request focus on a React Native view for TV platforms.
 * Uses the "pulse" pattern (setting hasTVPreferredFocus true → false) to force the native focus engine to update.
 *
 * @param target The ref or component instance to focus.
 * @param options Configuration options for the focus request.
 */
export const requestTVFocus = (target: TVFocusTarget, options?: RequestFocusOptions) => {
  const {
    duration = 300,
    priority = FocusPriority.DEFAULT,
    onFocusAcquired,
    onFocusDenied,
  } = options || {};

  const node = target && 'current' in target ? target.current : target;

  if (!node || typeof node.setNativeProps !== 'function') {
    if (__DEV__) {
      console.warn('[requestTVFocus] Invalid target or target does not support setNativeProps');
    }
    return;
  }

  // Check priority - deny if current priority is higher
  if (priority < currentGlobalPriority) {
    if (__DEV__) {
      console.warn(
        `[requestTVFocus] Request denied due to lower priority (requested: ${priority}, current: ${currentGlobalPriority})`
      );
    }
    onFocusDenied?.();
    return;
  }

  // Update global priority
  currentGlobalPriority = priority;

  // Set preferred focus
  node.setNativeProps({ hasTVPreferredFocus: true });

  // Use requestAnimationFrame for better performance
  requestAnimationFrame(() => {
    setTimeout(() => {
      // Reset the prop to allow future focus requests
      node.setNativeProps({ hasTVPreferredFocus: false });

      // Reset global priority after a delay
      setTimeout(() => {
        currentGlobalPriority = FocusPriority.DEFAULT;
      }, 100);

      // Invoke callback
      onFocusAcquired?.();
    }, duration);
  });
};

/**
 * Get the current global focus priority
 */
export const getCurrentFocusPriority = (): FocusPriority => {
  return currentGlobalPriority;
};

/**
 * Reset the global focus priority to default
 */
export const resetFocusPriority = () => {
  currentGlobalPriority = FocusPriority.DEFAULT;
};

