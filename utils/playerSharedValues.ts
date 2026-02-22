/**
 * playerSharedValues.ts
 *
 * Module-level Reanimated SharedValues for the player's high-frequency state.
 * Created with `makeMutable` so they can be written from plain JS (Zustand store)
 * and read on the UI thread inside `useAnimatedStyle` worklets — bypassing React's
 * render cycle entirely.
 *
 * Write from: playerStore (handlePlaybackStatusUpdate, seek, playEpisode, reset)
 * Read from:  PlayerProgressBar (useAnimatedStyle)
 */
import { makeMutable } from 'react-native-reanimated';

/** Playback progress [0, 1]. Updated at ~250ms cadence from expo-video. */
export const progressPositionSV = makeMutable(0);

/** Buffered/playable fraction [0, 1]. */
export const bufferedPositionSV = makeMutable(0);

/** Whether the user is actively seeking via the seek UI. */
export const isSeekingSV = makeMutable(false);

/** The seek target position [0, 1] while seeking. */
export const seekPositionSV = makeMutable(0);

/** Reset all shared values to their initial state (call on player reset / episode switch). */
export const resetPlayerSharedValues = () => {
    progressPositionSV.value = 0;
    bufferedPositionSV.value = 0;
    isSeekingSV.value = false;
    seekPositionSV.value = 0;
};
