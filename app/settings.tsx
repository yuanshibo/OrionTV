import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTVBackHandler } from "@/hooks/useTVBackHandler";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { StyledButton } from "@/components/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteMessage } from "@/hooks/useRemoteMessage";
import { APIConfigSection } from "@/components/settings/APIConfigSection";
import { LiveStreamSection } from "@/components/settings/LiveStreamSection";
import { RemoteInputSection } from "@/components/settings/RemoteInputSection";
import { UpdateSection } from "@/components/settings/UpdateSection";
import Toast from "react-native-toast-message";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type SectionItem = {
  component: React.ReactElement;
  key: string;
};

function isSectionItem(item: false | undefined | SectionItem): item is SectionItem {
  return !!item;
}

export default function SettingsScreen() {
  const { loadSettings, saveSettings, setApiBaseUrl, setM3uUrl } = useSettingsStore();
  const backgroundColor = useThemeColor({}, "background");
  const insets = useSafeAreaInsets();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const [isLoading, setIsLoading] = useState(false);

  const saveButtonRef = useRef<any>(null);
  const apiSectionRef = useRef<any>(null);
  const liveStreamSectionRef = useRef<any>(null);

  // TV遥控器返回键处理
  useTVBackHandler({ fallbackRoute: "/" });

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleRemoteInput = useCallback((message: string) => {
    if (message.startsWith("api:")) {
      const url = message.slice(4).trim();
      setApiBaseUrl(url);
      Toast.show({ type: "success", text1: "已填入远程 API 地址", text2: url });
      return;
    }

    if (message.startsWith("m3u:")) {
      const url = message.slice(4).trim();
      setM3uUrl(url);
      Toast.show({ type: "success", text1: "已填入远程直播源地址", text2: url });
      return;
    }

    // Fallback for plain messages
    const trimmed = message.trim();
    if (trimmed.toLowerCase().endsWith(".m3u") || trimmed.toLowerCase().includes(".m3u?")) {
      setM3uUrl(trimmed);
      Toast.show({ type: "success", text1: "已填入直播源地址", text2: trimmed });
    } else {
      setApiBaseUrl(trimmed);
      Toast.show({ type: "success", text1: "已填入 API 地址", text2: trimmed });
    }
  }, [setApiBaseUrl, setM3uUrl]);

  useRemoteMessage(handleRemoteInput);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await saveSettings();
      Toast.show({
        type: "success",
        text1: "保存成功",
      });
    } catch {
      Alert.alert("错误", "保存设置失败");
    } finally {
      setIsLoading(false);
    }
  };

  const rawSections = [
    // 远程输入配置 - 仅在非手机端显示
    deviceType !== "mobile" && {
      component: (
        <RemoteInputSection
          onChanged={() => {}}
        />
      ),
      key: "remote",
    },
    {
      component: (
        <APIConfigSection
          ref={apiSectionRef}
          onChanged={() => {}}
          hideDescription={deviceType === "mobile"}
        />
      ),
      key: "api",
    },
    // 直播源配置 - 仅在非手机端显示
    deviceType !== "mobile" && {
      component: (
        <LiveStreamSection
          ref={liveStreamSectionRef}
          onChanged={() => {}}
        />
      ),
      key: "livestream",
    },
    Platform.OS === "android" && {
      component: <UpdateSection />,
      key: "update",
    },
  ] as const;

  const sections: SectionItem[] = rawSections.filter(isSectionItem);
  const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType, spacing, insets), [deviceType, spacing, insets]);

  const innerContent = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {deviceType === "tv" && (
        <View style={dynamicStyles.header}>
          <ThemedText style={dynamicStyles.title}>设置</ThemedText>
        </View>
      )}

      <View style={dynamicStyles.scrollView}>
        {sections.map((item) => (
          <View key={item.key} style={dynamicStyles.itemWrapper}>
            {item.component}
          </View>
        ))}
      </View>

      <View style={dynamicStyles.footer}>
        <StyledButton
          ref={saveButtonRef}
          text={isLoading ? "保存中..." : "保存设置"}
          onPress={handleSave}
          variant="primary"
          disabled={isLoading}
          style={[dynamicStyles.saveButton, isLoading && dynamicStyles.disabledButton]}
        />
      </View>
    </ThemedView>
  );

  const renderSettingsContent = () => {
    if (deviceType === "tv") {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
        >
          {innerContent}
        </ScrollView>
      );
    }

    return (
      <KeyboardAwareScrollView
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardOpeningTime={0}
        keyboardShouldPersistTaps="always"
        scrollEnabled={true}
        style={{ flex: 1, backgroundColor }}
      >
        {innerContent}
      </KeyboardAwareScrollView>
    );
  };

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === "tv") {
    return renderSettingsContent();
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="设置" showBackButton />
      {renderSettingsContent()}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number, insets: any) => {
  const isMobile = deviceType === "mobile";
  const isTablet = deviceType === "tablet";
  const isTV = deviceType === "tv";
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing,
      paddingTop: isTV ? spacing * 2 : isMobile ? insets.top + spacing : insets.top + spacing * 1.5,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing,
    },
    title: {
      fontSize: isMobile ? 24 : isTablet ? 28 : 32,
      fontWeight: "bold",
      paddingTop: spacing,
      color: "white",
      height: 45,
    },
    scrollView: {
      flex: 1,
    },
    listContent: {
      paddingBottom: spacing,
    },
    footer: {
      paddingTop: spacing,
      paddingBottom: isTV ? 40 : 20,
      alignItems: isMobile ? "center" : "flex-end",
    },
    saveButton: {
      minHeight: isMobile ? minTouchTarget : 50,
      width: isMobile ? "100%" : isTablet ? 140 : 160,
      maxWidth: isMobile ? 280 : undefined,
    },
    disabledButton: {
      opacity: 0.5,
    },
    itemWrapper: {
      marginBottom: spacing,
    },
  });
};
