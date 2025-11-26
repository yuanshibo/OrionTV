/**
 * Focus Priority Levels
 * Higher values take precedence when multiple components request focus
 */
export enum FocusPriority {
    /** Modal dialogs and overlays - highest priority */
    MODAL = 100,

    /** Navigation elements (category tabs, menu items) */
    NAVIGATION = 50,

    /** Main content area (video cards, lists) */
    CONTENT = 10,

    /** Default priority for general focusable elements */
    DEFAULT = 0,
}

/**
 * Focus area identifiers for tracking current focus context
 */
export type FocusArea =
    | 'navigation'    // Category navigation bar
    | 'content'       // Main content grid
    | 'modal'         // Any modal overlay
    | 'player'        // Video player controls
    | 'settings'      // Settings screen
    | null;           // No specific area
