import { RefObject } from 'react';

/**
 * Type definition for a focusable target.
 * Can be a React RefObject or a direct component instance.
 */
type TVFocusTarget = RefObject<any> | { setNativeProps: (props: object) => void } | null | undefined;

/**
 * Utility to programmatically request focus on a React Native view for TV platforms.
 * Uses the "pulse" pattern (setting hasTVPreferredFocus true -> false) to force the native focus engine to update.
 *
 * @param target The ref or component instance to focus.
 * @param duration The duration in ms to hold the preferred focus state before resetting (default 500ms).
 */
export const requestTVFocus = (target: TVFocusTarget, duration = 500) => {
  const node = target && 'current' in target ? target.current : target;

  if (node && typeof node.setNativeProps === 'function') {
    node.setNativeProps({ hasTVPreferredFocus: true });

    // Reset the prop after a delay to ensure it can be triggered again later.
    // This is crucial because if the prop stays true, subsequent attempts to set it true might be ignored by the native layer.
    setTimeout(() => {
      node.setNativeProps({ hasTVPreferredFocus: false });
    }, duration);
  }
};
