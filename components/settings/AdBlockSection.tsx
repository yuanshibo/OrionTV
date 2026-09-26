import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable, useColorScheme } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors } from "@/constants/Colors";
import { Check, ShieldCheck } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface AdBlockSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

type AdBlockMode = "seamless" | "skip" | "off";

interface OptionItem {
  key: AdBlockMode;
  title: string;
  badge?: string;
  desc: string;
}

const OPTIONS: OptionItem[] = [
  {
    key: "seamless",
    title: "智能无缝去除",
    badge: "推荐",
    desc: "本地重写 M3U8 切片索引，剔除博彩、片头片中贴片广告，观影丝滑无黑屏、无卡顿",
  },
  {
    key: "skip",
    title: "自动快进跳过",
    desc: "播放原源流媒体，当播放进度到达已标记广告切片时自动向后 Seek 快进跳过",
  },
  {
    key: "off",
    title: "关闭去广告",
    desc: "不进行任何 M3U8 切片处理，直接播放原始视频流",
  },
];

export const AdBlockSection: React.FC<AdBlockSectionProps> = ({ onChanged, onFocus, onBlur }) => {
  const colorScheme = useColorScheme() === "light" ? "light" : "dark";
  const colors = Colors[colorScheme];
  const { deviceType } = useResponsiveLayout();
  const { adBlockMode, setAdBlockMode } = useSettingsStore();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const handleSelect = (mode: AdBlockMode) => {
    setAdBlockMode(mode);
    const selectedOption = OPTIONS.find((o) => o.key === mode);
    Toast.show({
      type: "success",
      text1: "已保存去广告设置",
      text2: selectedOption?.title,
      visibilityTime: 2000,
    });
    onChanged();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        },
        iconBadge: {
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
          alignItems: "center",
          justifyContent: "center",
        },
        title: {
          fontSize: deviceType === "tv" ? 18 : 16,
          fontWeight: "bold",
          color: colors.text,
        },
        subtitle: {
          fontSize: 13,
          color: colors.icon,
          marginBottom: 16,
          lineHeight: 18,
        },
        optionsContainer: {
          gap: 10,
        },
        optionItem: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          backgroundColor: colorScheme === "dark" ? "rgba(0, 0, 0, 0.25)" : "#f9fafb",
        },
        optionItemActive: {
          borderColor: colors.primary,
          backgroundColor: colorScheme === "dark" ? "rgba(210, 105, 30, 0.12)" : "rgba(255, 165, 0, 0.1)",
        },
        optionItemFocused: {
          borderColor: colors.tint,
          shadowColor: colors.tint,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 10,
          elevation: 5,
          transform: [{ scale: 1.015 }],
        },
        textContainer: {
          flex: 1,
          marginRight: 12,
        },
        titleRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        },
        optionTitle: {
          fontSize: deviceType === "tv" ? 16 : 15,
          fontWeight: "600",
          color: colors.text,
        },
        badgePill: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 6,
          backgroundColor: "rgba(210, 105, 30, 0.2)",
          borderWidth: 1,
          borderColor: colors.primary,
        },
        badgeText: {
          fontSize: 11,
          color: colors.primary,
          fontWeight: "bold",
        },
        optionDesc: {
          fontSize: 12,
          color: colors.icon,
          lineHeight: 17,
        },
        checkCircle: {
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
          alignItems: "center",
          justifyContent: "center",
        },
        checkCircleActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
      }),
    [colors, colorScheme, deviceType]
  );

  return (
    <SettingsSection
      focusable={false}
      onFocus={onFocus}
      onBlur={() => {
        setFocusedKey(null);
        onBlur?.();
      }}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <ShieldCheck size={18} color={colors.primary} />
        </View>
        <ThemedText style={styles.title}>M3U8 切片去广告</ThemedText>
      </View>
      <ThemedText style={styles.subtitle}>
        自动识别切片广告（如博彩、开屏、片中插播广告），提供 TV 端原生无缝过滤或自动快进跳过。
      </ThemedText>

      <View style={styles.optionsContainer}>
        {OPTIONS.map((item) => {
          const isSelected = adBlockMode === item.key;
          const isFocused = focusedKey === item.key;

          return (
            <Pressable
              key={item.key}
              hasTVPreferredFocus={isSelected}
              onFocus={() => setFocusedKey(item.key)}
              onBlur={() => setFocusedKey(null)}
              onPress={() => handleSelect(item.key)}
              style={[
                styles.optionItem,
                isSelected && styles.optionItemActive,
                isFocused && styles.optionItemFocused,
              ]}
            >
              <View style={styles.textContainer}>
                <View style={styles.titleRow}>
                  <ThemedText
                    style={[
                      styles.optionTitle,
                      isSelected && { color: colors.tint },
                    ]}
                  >
                    {item.title}
                  </ThemedText>
                  {item.badge && (
                    <View style={styles.badgePill}>
                      <ThemedText style={styles.badgeText}>{item.badge}</ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={styles.optionDesc}>{item.desc}</ThemedText>
              </View>

              <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                {isSelected && <Check size={15} color="#ffffff" strokeWidth={3} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </SettingsSection>
  );
};
