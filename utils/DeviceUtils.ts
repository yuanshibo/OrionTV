import { Platform, Dimensions } from "react-native";
import { DeviceType } from "@/hooks/useResponsiveLayout";

const isTVPlatform = (): boolean => {
  // This function is the single source of truth for raw platform detection.
  if (Platform.isTV) {
    return true;
  }

  // Fallbacks for other potential TV platform identifiers in some RN versions/forks.
  const platformConstants = (Platform as any)?.constants;
  if (platformConstants?.interfaceIdiom === "tv") {
    return true;
  }

  if (platformConstants?.isTV === true) {
    return true;
  }

  return false;
};

export const DeviceUtils = {
  /**
   * Detects the layout type for the device.
   * This is for determining responsive layouts (e.g., mobile, tablet, or tv UI).
   */
  getDeviceType(): DeviceType {
    // First, check if it's a real TV platform. If so, the layout is always 'tv'.
    if (this.isTV()) {
      return "tv";
    }

    // For non-TV platforms (like web, phones, or tablets), determine the layout by screen width.
    const { width } = Dimensions.get("window");

    if (width >= 1024) {
      return "tv"; // Use TV-like layout for large screens (e.g., web browser).
    } else if (width >= 768) {
      return "tablet";
    } else {
      return "mobile";
    }
  },

  /**
   * Checks if the runtime environment is a recognized TV platform.
   * This is the definitive source of truth for TV-specific capabilities (e.g., remote control).
   * It does NOT use screen width for detection.
   */
  isTV(): boolean {
    return isTVPlatform();
  },

  /**
   * Checks if the device should use the 'mobile' layout.
   */
  isMobile(): boolean {
    return this.getDeviceType() === "mobile";
  },

  /**
   * Checks if the device should use the 'tablet' layout.
   */
  isTablet(): boolean {
    return this.getDeviceType() === "tablet";
  },

  /**
   * Checks if the device primarily supports touch interaction.
   */
  supportsTouchInteraction(): boolean {
    // True for anything that isn't a recognized TV platform.
    return !this.isTV();
  },

  /**
   * Checks if the device primarily supports remote control interaction.
   */
  supportsRemoteControlInteraction(): boolean {
    // Only true for recognized TV platforms.
    return this.isTV();
  },

  /**
   * Gets the minimum recommended touch target size for the current device layout.
   */
  getMinTouchTargetSize(): number {
    const deviceType = this.getDeviceType();
    switch (deviceType) {
      case "mobile":
        return 44; // iOS HIG minimum
      case "tablet":
        return 48; // Material Design minimum
      case "tv":
        return 60; // TV optimized
      default:
        return 44;
    }
  },

  /**
   * Gets a scaled font size suitable for the current device layout.
   */
  getOptimalFontSize(baseSize: number): number {
    const deviceType = this.getDeviceType();
    const scaleFactor = {
      mobile: 1.0,
      tablet: 1.1,
      tv: 1.25,
    }[deviceType];

    return Math.round(baseSize * scaleFactor);
  },

  /**
   * Gets a scaled spacing value suitable for the current device layout.
   */
  getOptimalSpacing(baseSpacing: number): number {
    const deviceType = this.getDeviceType();
    const scaleFactor = {
      mobile: 0.8,
      tablet: 1.0,
      tv: 1.5,
    }[deviceType];

    return Math.round(baseSpacing * scaleFactor);
  },

  /**
   * Checks if the device is in landscape orientation.
   */
  isLandscape(): boolean {
    const { width, height } = Dimensions.get("window");
    return width > height;
  },

  /**
   * Checks if the device is in portrait orientation.
   */
  isPortrait(): boolean {
    return !this.isLandscape();
  },

  /**
   * Gets a safe number of columns for a grid layout based on screen width.
   */
  getSafeColumnCount(preferredColumns: number): number {
    const { width } = Dimensions.get("window");
    const minCardWidth = this.isMobile() ? 120 : this.isTablet() ? 140 : 160;
    const maxColumns = Math.floor(width / minCardWidth);

    return Math.min(preferredColumns, maxColumns > 0 ? maxColumns : 1);
  },

  /**
   * Gets a device-specific animation duration.
   */
  getAnimationDuration(baseDuration: number): number {
    const deviceType = this.getDeviceType();
    // TV animations are slightly slower for a 10-foot UI experience.
    const scaleFactor = {
      mobile: 1.0,
      tablet: 1.0,
      tv: 1.2,
    }[deviceType];

    return Math.round(baseDuration * scaleFactor);
  },
};
