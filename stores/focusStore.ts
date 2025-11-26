import { create } from 'zustand';
import { FocusArea, FocusPriority } from '@/types/focus';

interface FocusState {
    /** Current focus area context */
    currentFocusArea: FocusArea;

    /** History of focus areas for restoration */
    focusHistory: FocusArea[];

    /** Current focus priority level */
    currentPriority: FocusPriority;

    /** Debug mode flag */
    debugMode: boolean;
}

interface FocusActions {
    /** Set the current focus area and update history */
    setFocusArea: (area: FocusArea, priority?: FocusPriority) => void;

    /** Restore focus to the previous area in history */
    restorePreviousFocus: () => FocusArea | null;

    /** Get current priority level */
    getCurrentPriority: () => FocusPriority;

    /** Clear focus history */
    clearHistory: () => void;

    /** Toggle debug mode */
    toggleDebug: () => void;

    /** Reset to initial state */
    reset: () => void;
}

type FocusStore = FocusState & FocusActions;

const initialState: FocusState = {
    currentFocusArea: null,
    focusHistory: [],
    currentPriority: FocusPriority.DEFAULT,
    debugMode: __DEV__,
};

export const useFocusStore = create<FocusStore>((set, get) => ({
    ...initialState,

    setFocusArea: (area, priority = FocusPriority.DEFAULT) => {
        const { currentFocusArea, focusHistory, debugMode } = get();

        if (debugMode) {
            console.log(`[FocusStore] Setting focus area: ${currentFocusArea} → ${area} (priority: ${priority})`);
        }

        // Add current area to history before changing
        const newHistory = currentFocusArea
            ? [...focusHistory, currentFocusArea].slice(-10) // Keep last 10 items
            : focusHistory;

        set({
            currentFocusArea: area,
            focusHistory: newHistory,
            currentPriority: priority,
        });
    },

    restorePreviousFocus: () => {
        const { focusHistory, debugMode } = get();

        if (focusHistory.length === 0) {
            if (debugMode) {
                console.log('[FocusStore] No focus history to restore');
            }
            return null;
        }

        const previousArea = focusHistory[focusHistory.length - 1];
        const newHistory = focusHistory.slice(0, -1);

        if (debugMode) {
            console.log(`[FocusStore] Restoring focus to: ${previousArea}`);
        }

        set({
            currentFocusArea: previousArea,
            focusHistory: newHistory,
            currentPriority: FocusPriority.DEFAULT,
        });

        return previousArea;
    },

    getCurrentPriority: () => get().currentPriority,

    clearHistory: () => {
        if (get().debugMode) {
            console.log('[FocusStore] Clearing focus history');
        }
        set({ focusHistory: [] });
    },

    toggleDebug: () => {
        set((state) => ({ debugMode: !state.debugMode }));
    },

    reset: () => {
        if (get().debugMode) {
            console.log('[FocusStore] Resetting focus store');
        }
        set(initialState);
    },
}));

// Selectors for optimized re-renders
export const selectCurrentFocusArea = (state: FocusStore) => state.currentFocusArea;
export const selectFocusHistory = (state: FocusStore) => state.focusHistory;
export const selectCurrentPriority = (state: FocusStore) => state.currentPriority;
