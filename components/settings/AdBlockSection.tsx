import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable, useColorScheme } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors } from "@/constants/Colors";
import { Check } from "lucide-react-native";
import Toast from "react-native-toast-message";

interface AdBlockSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

type AdBlockMode = "seamless" | "skip" | "off";

interface OptionItem {
  key: AdBlockMode;
  title: string;
  desc: string;
}

const OPTIONS: OptionItem[] = [
  {
    key: "seamless",
    title: "智能无缝去除 (推荐)",
    desc: "本地智能重写 M3U8 切片，剔除广告片段，观影丝滑无黑屏、无停顿",
  },
  {
    key: "skip",
    title: "自动快进跳过",
    desc: "播放原源流媒体，播放器到达广告点时自动向后 Seek 快进跳过",
  },
  {
    key: "off",
    title: "关闭去广告",
    desc: "不进行任何去广告处理，直接播放原始视频流",
  },
];

export const AdBlockSection: React.FC<AdBlockSectionProps> = ({ onChanged, onFocus, onBlur }) => {
  const colorScheme = useColorScheme() === "light" ? "light" : "dark";
  const colors = Colors[colorScheme];
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
        title: {
          fontSize: 18,
          fontWeight: "bold",
          marginBottom: 6,
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
          borderRadius: 8,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        optionItemActive: {
          borderColor: colors.primary,
          backgroundColor: colors.border,
        },
        optionItemFocused: {
          borderColor: colors.tint,
          transform: [{ scale: 1.02 }],
        },
        textContainer: {
          flex: 1,
          marginRight: 12,
        },
        optionTitle: {
          fontSize: 15,
          fontWeight: "600",
          marginBottom: 4,
        },
        optionDesc: {
          fontSize: 12,
          color: colors.icon,
          lineHeight: 16,
        },
        checkIcon: {
          width: 24,
          height: 24,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors]
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
      <ThemedText style={styles.title}>M3U8 切片去广告</ThemedText>
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
                <ThemedText
                  style={[
                    styles.optionTitle,
                    isSelected && { color: colors.tint },
                  ]}
                >
                  {item.title}
                </ThemedText>
                <ThemedText style={styles.optionDesc}>{item.desc}</ThemedText>
              </View>

              <View style={styles.checkIcon}>
                {isSelected && <Check size={20} color={colors.tint} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </SettingsSection>
  );
};
