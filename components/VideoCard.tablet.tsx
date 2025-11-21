import React, { useState, useEffect, useCallback, useRef, forwardRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, Play } from "lucide-react-native";
import { PlayRecordManager } from "@/services/storage";
import { API } from "@/services/api";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('VideoCardTablet');

interface VideoCardTabletProps extends React.ComponentProps<typeof TouchableOpacity> {
  id: string;
  source: string;
  title: string;
  poster: string;
  year?: string;
  rate?: string;
  sourceName?: string;
  progress?: number;
  playTime?: number;
  episodeIndex?: number;
  totalEpisodes?: number;
  onFocus?: () => void;
  onRecordDeleted?: () => void;
  api: API;
}

const VideoCardTablet = forwardRef<View, VideoCardTabletProps>(
  (
    {
      id,
      source,
      title,
      poster,
      year,
      rate,
      sourceName,
      progress,
      episodeIndex,
      onFocus,
      onRecordDeleted,
      api,
      playTime = 0,
    }: VideoCardTabletProps,
    ref
  ) => {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'dark';
    const colors = Colors[colorScheme];
    const { cardWidth, cardHeight, spacing } = useResponsiveLayout();
    const [fadeAnim] = useState(new Animated.Value(0));
    const [isPressed, setIsPressed] = useState(false);

    const longPressTriggered = useRef(false);
    const lastPressTime = useRef(0);
    const scale = useRef(new Animated.Value(1)).current;
    const fadeInAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
    const scaleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    const handlePress = () => {
      const now = Date.now();
      if (now - lastPressTime.current < 500) return;
      lastPressTime.current = now;

      if (longPressTriggered.current) {
        longPressTriggered.current = false;
        return;
      }
      
      if (progress !== undefined && episodeIndex !== undefined) {
        router.push({
          pathname: "/play",
          params: { source, id, episodeIndex: episodeIndex - 1, title, position: playTime * 1000 },
        });
      } else {
        router.push({
          pathname: "/detail",
          params: { source, q: title },
        });
      }
    };

    const runScaleAnimation = useCallback(
      (toValue: number) => {
        scaleAnimationRef.current?.stop();
        const animation = Animated.spring(scale, {
          toValue,
          damping: 15,
          stiffness: 300,
          useNativeDriver: true,
        });
        scaleAnimationRef.current = animation;
        animation.start(() => {
          if (scaleAnimationRef.current === animation) {
            scaleAnimationRef.current = null;
          }
        });
      },
      [scale]
    );

    const handlePressIn = useCallback(() => {
      setIsPressed(true);
      runScaleAnimation(0.96);
    }, [runScaleAnimation]);

    const handlePressOut = useCallback(() => {
      setIsPressed(false);
      runScaleAnimation(1.0);
    }, [runScaleAnimation]);

    useEffect(() => {
      fadeInAnimationRef.current?.stop();
      const animation = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: DeviceUtils.getAnimationDuration(400),
        delay: Math.random() * 150,
        useNativeDriver: true,
      });
      fadeInAnimationRef.current = animation;
      animation.start(() => {
        if (fadeInAnimationRef.current === animation) {
          fadeInAnimationRef.current = null;
        }
      });

      return () => {
        animation.stop();
      };
    }, [fadeAnim]);

    useEffect(() => {
      return () => {
        fadeInAnimationRef.current?.stop();
        scaleAnimationRef.current?.stop();
      };
    }, []);

    const handleLongPress = () => {
      if (progress === undefined) return;

      longPressTriggered.current = true;

      Alert.alert("删除观看记录", `确定要删除"${title}"的观看记录吗？`, [
        {
          text: "取消",
          style: "cancel",
        },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              await PlayRecordManager.remove(source, id);
              onRecordDeleted?.();
            } catch (error) {
              logger.info("Failed to delete play record:", error);
              Alert.alert("错误", "删除观看记录失败，请重试");
            }
          },
        },
      ]);
    };

    const isContinueWatching = progress !== undefined && progress > 0 && progress < 1;

    const animatedStyle = {
      transform: [{ scale }],
    };

    const styles = useMemo(() => createTabletStyles(cardWidth, cardHeight, spacing, colors), [cardWidth, cardHeight, spacing, colors]);

    return (
      <Animated.View style={[styles.wrapper, animatedStyle, { opacity: fadeAnim }]} ref={ref}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          style={styles.pressable}
          activeOpacity={1}
          delayLongPress={900}
        >
          <View style={[styles.card, isPressed && styles.cardPressed]}>
            <Image source={{ uri: api.getImageProxyUrl(poster) }} style={styles.poster} contentFit="cover" transition={300} />
            
            {/* 悬停效果遮罩 */}
            {isPressed && (
              <View style={styles.pressOverlay}>
                {isContinueWatching && (
                  <View style={styles.continueWatchingBadge}>
                    <Play size={16} color={colors.text} fill={colors.text} />
                    <Text style={styles.continueWatchingText}>继续观看</Text>
                  </View>
                )}
              </View>
            )}

            {/* 进度条 */}
            {isContinueWatching && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(progress || 0) * 100}%` }]} />
              </View>
            )}

            {/* 评分 */}
            {rate && (
              <View style={styles.ratingContainer}>
                <Star size={12} color={colors.tint} fill={colors.tint} />
                <Text style={styles.ratingText}>{rate}</Text>
              </View>
            )}

            {/* 年份 */}
            {year && (
              <View style={styles.yearBadge}>
                <Text style={styles.badgeText}>{year}</Text>
              </View>
            )}

            {/* 来源 */}
            {sourceName && (
              <View style={styles.sourceNameBadge}>
                <Text style={styles.badgeText}>{sourceName}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoContainer}>
            <ThemedText numberOfLines={2} style={styles.title}>{title}</ThemedText>
            {isContinueWatching && (
              <View style={styles.infoRow}>
                <ThemedText style={styles.continueLabel} numberOfLines={1}>
                  第{episodeIndex! + 1}集 已观看 {Math.round((progress || 0) * 100)}%
                </ThemedText>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

VideoCardTablet.displayName = "VideoCardTablet";

const createTabletStyles = (cardWidth: number, cardHeight: number, spacing: number, colors: typeof Colors.dark) => {
  return StyleSheet.create({
    wrapper: {
      width: cardWidth,
      marginHorizontal: spacing / 2,
      marginBottom: spacing,
    },
    pressable: {
      alignItems: 'center',
    },
    card: {
      width: cardWidth,
      height: cardHeight,
      borderRadius: 10,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    cardPressed: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    poster: {
      width: "100%",
      height: "100%",
    },
    pressOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 10,
    },
    progressContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.primary,
    },
    continueWatchingBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    continueWatchingText: {
      color: colors.text,
      marginLeft: 6,
      fontSize: 14,
      fontWeight: "bold",
    },
    ratingContainer: {
      position: "absolute",
      top: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    ratingText: {
      color: colors.tint,
      fontSize: 11,
      fontWeight: "bold",
      marginLeft: 3,
    },
    yearBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    sourceNameBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    badgeText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "bold",
    },
    infoContainer: {
      width: cardWidth,
      marginTop: 8,
      alignItems: "flex-start",
      paddingHorizontal: 4,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginTop: 2,
    },
    title: {
      fontSize: 15,
      lineHeight: 18,
    },
    continueLabel: {
      color: colors.primary,
      fontSize: 12,
    },
  });
};

export default VideoCardTablet;
