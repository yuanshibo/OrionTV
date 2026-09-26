import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, Alert, Platform, ScrollView, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTVBackHandler } from "@/hooks/useTVBackHandler";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { StyledButton } from "@/components/StyledButton";
import { Colors } from "@/constants/Colors";
import { useSettingsStore } from "@/stores/settingsStore";
import useAuthStore from "@/stores/authStore";
import { useUpdateStore } from "@/stores/updateStore";
import { APIConfigSection, APIConfigSectionRef } from "@/components/settings/APIConfigSection";
import { UpdateSection } from "@/components/settings/UpdateSection";
import { AdBlockSection } from "@/components/settings/AdBlockSection";
import { SettingsSection } from "@/components/settings/SettingsSection";
import Toast from "react-native-toast-message";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  Server,
  Film,
  Info,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react-native";

export default function SettingsScreen() {
  const { loadSettings, saveSettings, serverConfig, apiBaseUrl } = useSettingsStore();
  const { isLoggedIn, logout, showLoginModal } = useAuthStore();
  const { currentVersion } = useUpdateStore();

  const colorScheme = useColorScheme() === "light" ? "light" : "dark";
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const [isLoading, setIsLoading] = useState(false);

  const saveButtonTopRef = useRef<any>(null);
  const saveButtonBottomRef = useRef<any>(null);
  const apiSectionRef = useRef<APIConfigSectionRef>(null);

  // TV 遥控器返回键处理
  useTVBackHandler({ fallbackRoute: "/" });

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await saveSettings();
      Toast.show({
        type: "success",
        text1: "设置保存成功",
        text2: "所有配置已生效",
      });
    } catch {
      Alert.alert("错误", "保存设置失败，请检查配置参数");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("退出登录", "确定要退出当前账号并清除登录凭据吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定退出",
        style: "destructive",
        onPress: async () => {
          await logout();
          Toast.show({ type: "info", text1: "已退出登录" });
        },
      },
    ]);
  };

  const dynamicStyles = useMemo(
    () => createResponsiveStyles(deviceType, spacing, insets, colors, colorScheme),
    [deviceType, spacing, insets, colors, colorScheme]
  );

  const renderAccountCard = () => {
    return (
      <SettingsSection focusable={false}>
        <View style={dynamicStyles.sectionHeaderRow}>
          <View style={dynamicStyles.iconBadge}>
            <Info size={18} color={colors.primary} />
          </View>
          <ThemedText style={dynamicStyles.sectionTitle}>服务与账户状态</ThemedText>
        </View>

        <View style={dynamicStyles.infoGrid}>
          <View style={dynamicStyles.infoRow}>
            <ThemedText style={dynamicStyles.infoLabel}>后端站点</ThemedText>
            <ThemedText style={dynamicStyles.infoValue}>
              {serverConfig?.SiteName || "默认服务器"}
            </ThemedText>
          </View>
          <View style={dynamicStyles.infoRow}>
            <ThemedText style={dynamicStyles.infoLabel}>存储模式</ThemedText>
            <ThemedText style={dynamicStyles.infoValue}>
              {serverConfig?.StorageType || "localstorage"}
            </ThemedText>
          </View>
          <View style={dynamicStyles.infoRow}>
            <ThemedText style={dynamicStyles.infoLabel}>认证状态</ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isLoggedIn ? (
                <>
                  <CheckCircle2 size={15} color="#4ade80" />
                  <ThemedText style={{ color: "#4ade80", fontWeight: "600", fontSize: 14 }}>
                    已登录
                  </ThemedText>
                </>
              ) : (
                <ThemedText style={{ color: colors.icon, fontSize: 14 }}>
                  未登录 / 游客
                </ThemedText>
              )}
            </View>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          {isLoggedIn ? (
            <StyledButton
              text="退出登录"
              variant="default"
              onPress={handleLogout}
              style={dynamicStyles.accountButton}
            />
          ) : (
            <StyledButton
              text="切换账号 / 登录"
              variant="primary"
              onPress={showLoginModal}
              style={dynamicStyles.accountButton}
            />
          )}
        </View>
      </SettingsSection>
    );
  };

  const innerContent = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {/* TV 模式精致 Header 区域 */}
      {deviceType === "tv" && (
        <View style={dynamicStyles.tvHeader}>
          <View style={dynamicStyles.tvHeaderLeft}>
            <View style={dynamicStyles.titleRow}>
              <SlidersHorizontal size={28} color={colors.primary} />
              <ThemedText style={dynamicStyles.tvTitle}>系统设置</ThemedText>
            </View>
            <View style={dynamicStyles.statusPill}>
              <View
                style={[
                  dynamicStyles.statusDot,
                  { backgroundColor: apiBaseUrl ? "#4ade80" : "#f87171" },
                ]}
              />
              <ThemedText style={dynamicStyles.statusPillText}>
                {apiBaseUrl ? `已配置 API · OrionTV v${currentVersion}` : `未配置 API · v${currentVersion}`}
              </ThemedText>
            </View>
          </View>

          <StyledButton
            ref={saveButtonTopRef}
            text={isLoading ? "保存中..." : "保存设置"}
            onPress={handleSave}
            variant="primary"
            disabled={isLoading}
            style={dynamicStyles.topSaveButton}
          />
        </View>
      )}

      {/* 分组 1: 网络与服务 */}
      <View style={dynamicStyles.groupContainer}>
        <View style={dynamicStyles.groupHeaderRow}>
          <Server size={18} color={colors.primary} />
          <ThemedText style={dynamicStyles.groupHeading}>网络与服务</ThemedText>
        </View>

        <View style={dynamicStyles.itemWrapper}>
          <APIConfigSection
            ref={apiSectionRef}
            onChanged={() => {}}
            hideDescription={deviceType === "mobile"}
          />
        </View>
      </View>

      {/* 分组 2: 播放与过滤 */}
      <View style={dynamicStyles.groupContainer}>
        <View style={dynamicStyles.groupHeaderRow}>
          <Film size={18} color={colors.primary} />
          <ThemedText style={dynamicStyles.groupHeading}>播放与去广告</ThemedText>
        </View>

        <View style={dynamicStyles.itemWrapper}>
          <AdBlockSection onChanged={() => {}} />
        </View>
      </View>

      {/* 分组 3: 系统与账户 */}
      <View style={dynamicStyles.groupContainer}>
        <View style={dynamicStyles.groupHeaderRow}>
          <Info size={18} color={colors.primary} />
          <ThemedText style={dynamicStyles.groupHeading}>系统与状态</ThemedText>
        </View>

        {renderAccountCard()}

        {Platform.OS === "android" && (
          <View style={dynamicStyles.itemWrapper}>
            <UpdateSection />
          </View>
        )}
      </View>

      {/* 底部保存按钮 */}
      <View style={dynamicStyles.footer}>
        <StyledButton
          ref={saveButtonBottomRef}
          text={isLoading ? "保存中..." : "保存全部设置"}
          onPress={handleSave}
          variant="primary"
          disabled={isLoading}
          style={[dynamicStyles.bottomSaveButton, isLoading && dynamicStyles.disabledButton]}
        />
      </View>
    </ThemedView>
  );

  const renderSettingsContent = () => {
    if (deviceType === "tv") {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
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
        style={{ flex: 1, backgroundColor: colors.background }}
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
      <ResponsiveHeader title="系统设置" showBackButton />
      {renderSettingsContent()}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (
  deviceType: string,
  spacing: number,
  insets: any,
  colors: any,
  colorScheme: string
) => {
  const isMobile = deviceType === "mobile";
  const isTablet = deviceType === "tablet";
  const isTV = deviceType === "tv";

  return StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing,
      paddingTop: isTV ? spacing * 1.5 : isMobile ? insets.top + spacing : insets.top + spacing * 1.5,
      maxWidth: isTV ? 1100 : undefined,
      alignSelf: isTV ? "center" : undefined,
      width: isTV ? "100%" : undefined,
    },
    tvHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing * 1.5,
      paddingBottom: spacing,
      borderBottomWidth: 1,
      borderBottomColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
    },
    tvHeaderLeft: {
      gap: 6,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    tvTitle: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.text,
      letterSpacing: 0.5,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
      alignSelf: "flex-start",
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusPillText: {
      fontSize: 12,
      color: colors.icon,
      fontWeight: "500",
    },
    topSaveButton: {
      height: 48,
      paddingHorizontal: 24,
      borderRadius: 10,
    },
    groupContainer: {
      marginBottom: spacing * 1.2,
    },
    groupHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
      marginLeft: 4,
    },
    groupHeading: {
      fontSize: isTV ? 17 : 15,
      fontWeight: "700",
      color: colors.icon,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    itemWrapper: {
      marginBottom: 0,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    iconBadge: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      fontSize: isTV ? 18 : 16,
      fontWeight: "bold",
      color: colors.text,
    },
    infoGrid: {
      backgroundColor: colorScheme === "dark" ? "rgba(0, 0, 0, 0.25)" : "#f9fafb",
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
      gap: 10,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    infoLabel: {
      fontSize: isTV ? 15 : 14,
      color: colors.icon,
    },
    infoValue: {
      fontSize: isTV ? 15 : 14,
      color: colors.text,
      fontWeight: "500",
    },
    accountButton: {
      height: 44,
      borderRadius: 8,
    },
    footer: {
      paddingTop: spacing,
      paddingBottom: isTV ? 40 : 20,
      alignItems: isMobile ? "center" : "flex-end",
    },
    bottomSaveButton: {
      height: 50,
      width: isMobile ? "100%" : isTablet ? 180 : 200,
      borderRadius: 10,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
};
