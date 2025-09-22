import { Dimensions, ScaledSize } from "react-native";
import { DeviceUtils } from "../DeviceUtils";

jest.mock("react-native", () => ({
  Dimensions: {
    get: jest.fn(),
  },
}));

const mockedDimensions = Dimensions as jest.Mocked<typeof Dimensions>;

const createScaledSize = (width: number, height: number): ScaledSize => ({
  width,
  height,
  scale: 1,
  fontScale: 1,
});

const mockDimensions = (width: number, height: number) => {
  mockedDimensions.get.mockReturnValue(createScaledSize(width, height));
};

describe("DeviceUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDeviceType", () => {
    it("应该在宽度 >= 1024 时返回 tv", () => {
      mockDimensions(1024, 768);
      expect(DeviceUtils.getDeviceType()).toBe("tv");
    });

    it("应该在宽度 >= 768 且 < 1024 时返回 tablet", () => {
      mockDimensions(768, 1024);
      expect(DeviceUtils.getDeviceType()).toBe("tablet");
    });

    it("应该在宽度 < 768 时返回 mobile", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.getDeviceType()).toBe("mobile");
    });
  });

  describe("isTV", () => {
    it("应该在 TV 设备上返回 true", () => {
      mockDimensions(1920, 1080);
      expect(DeviceUtils.isTV()).toBe(true);
    });

    it("应该在非 TV 设备上返回 false", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.isTV()).toBe(false);
    });
  });

  describe("isMobile", () => {
    it("应该在移动设备上返回 true", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.isMobile()).toBe(true);
    });

    it("应该在非移动设备上返回 false", () => {
      mockDimensions(1024, 768);
      expect(DeviceUtils.isMobile()).toBe(false);
    });
  });

  describe("isTablet", () => {
    it("应该在平板设备上返回 true", () => {
      mockDimensions(768, 1024);
      expect(DeviceUtils.isTablet()).toBe(true);
    });

    it("应该在非平板设备上返回 false", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.isTablet()).toBe(false);
    });
  });

  describe("supportsTouchInteraction", () => {
    it("应该在非 TV 设备上返回 true", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.supportsTouchInteraction()).toBe(true);
    });

    it("应该在 TV 设备上返回 false", () => {
      mockDimensions(1920, 1080);
      expect(DeviceUtils.supportsTouchInteraction()).toBe(false);
    });
  });

  describe("supportsRemoteControlInteraction", () => {
    it("应该在 TV 设备上返回 true", () => {
      mockDimensions(1920, 1080);
      expect(DeviceUtils.supportsRemoteControlInteraction()).toBe(true);
    });

    it("应该在非 TV 设备上返回 false", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.supportsRemoteControlInteraction()).toBe(false);
    });
  });

  describe("getMinTouchTargetSize", () => {
    it("应该为 mobile 设备返回 44", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.getMinTouchTargetSize()).toBe(44);
    });

    it("应该为 tablet 设备返回 48", () => {
      mockDimensions(768, 1024);
      expect(DeviceUtils.getMinTouchTargetSize()).toBe(48);
    });

    it("应该为 tv 设备返回 60", () => {
      mockDimensions(1920, 1080);
      expect(DeviceUtils.getMinTouchTargetSize()).toBe(60);
    });
  });

  describe("getOptimalFontSize", () => {
    it("应该为 mobile 设备返回基础大小 * 1.0", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.getOptimalFontSize(16)).toBe(16);
    });

    it("应该为 tablet 设备返回基础大小 * 1.1", () => {
      mockDimensions(768, 1024);
      expect(DeviceUtils.getOptimalFontSize(16)).toBe(18);
    });

    it("应该为 tv 设备返回基础大小 * 1.25", () => {
      mockDimensions(1920, 1080);
      expect(DeviceUtils.getOptimalFontSize(16)).toBe(20);
    });
  });

  describe("getOptimalSpacing", () => {
    it("应该为 mobile 设备返回基础间距 * 0.8", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.getOptimalSpacing(20)).toBe(16);
    });

    it("应该为 tablet 设备返回基础间距 * 1.0", () => {
      mockDimensions(768, 1024);
      expect(DeviceUtils.getOptimalSpacing(20)).toBe(20);
    });

    it("应该为 tv 设备返回基础间距 * 1.5", () => {
      mockDimensions(1920, 1080);
      expect(DeviceUtils.getOptimalSpacing(20)).toBe(30);
    });
  });

  describe("isLandscape", () => {
    it("应该在横屏模式下返回 true", () => {
      mockDimensions(812, 375);
      expect(DeviceUtils.isLandscape()).toBe(true);
    });

    it("应该在竖屏模式下返回 false", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.isLandscape()).toBe(false);
    });

    it("应该在宽高相等时返回 false", () => {
      mockDimensions(500, 500);
      expect(DeviceUtils.isLandscape()).toBe(false);
    });
  });

  describe("isPortrait", () => {
    it("应该在竖屏模式下返回 true", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.isPortrait()).toBe(true);
    });

    it("应该在横屏模式下返回 false", () => {
      mockDimensions(812, 375);
      expect(DeviceUtils.isPortrait()).toBe(false);
    });
  });

  describe("getSafeColumnCount", () => {
    it("应该在 mobile 设备上返回安全列数", () => {
      mockDimensions(375, 812);
      // minCardWidth = 120, maxColumns = 375 / 120 = 3.125 = 3
      expect(DeviceUtils.getSafeColumnCount(5)).toBe(3);
      expect(DeviceUtils.getSafeColumnCount(2)).toBe(2);
    });

    it("应该在 tablet 设备上返回安全列数", () => {
      mockDimensions(768, 1024);
      // minCardWidth = 140, maxColumns = 768 / 140 = 5.485 = 5
      expect(DeviceUtils.getSafeColumnCount(6)).toBe(5);
      expect(DeviceUtils.getSafeColumnCount(3)).toBe(3);
    });

    it("应该在 tv 设备上返回安全列数", () => {
      mockDimensions(1920, 1080);
      // minCardWidth = 160, maxColumns = 1920 / 160 = 12
      expect(DeviceUtils.getSafeColumnCount(15)).toBe(12);
      expect(DeviceUtils.getSafeColumnCount(8)).toBe(8);
    });
  });

  describe("getAnimationDuration", () => {
    it("应该为 mobile 设备返回基础持续时间 * 1.0", () => {
      mockDimensions(375, 812);
      expect(DeviceUtils.getAnimationDuration(300)).toBe(300);
    });

    it("应该为 tablet 设备返回基础持续时间 * 1.0", () => {
      mockDimensions(768, 1024);
      expect(DeviceUtils.getAnimationDuration(300)).toBe(300);
    });

    it("应该为 tv 设备返回基础持续时间 * 1.2", () => {
      mockDimensions(1920, 1080);
      expect(DeviceUtils.getAnimationDuration(300)).toBe(360);
    });
  });
});