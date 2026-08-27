import React, { useCallback, forwardRef, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Platform, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { Star, Play, RotateCcw } from "lucide-react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay
} from "react-native-reanimated";
import { api } from "@/services/api";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import useAuthStore from "@/stores/authStore";
import { useVideoCardInteractions } from "@/hooks/useVideoCardInteractions";
import { createShallowEqualComparator } from "@/utils/MemoHelper";

import { VideoCardTVProps } from './VideoCard.types';

type VideoCardProps = VideoCardTVProps & { index?: number };

function formatRelativeTime(timestamp?: number): string | null {
  if (!timestamp) return null;
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60 * 1000) return '刚刚';
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

const VideoCard = forwardRef<View, VideoCardProps>(
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
      totalEpisodes,
      lastPlayed,
      onFocus,
      onLongPress,
      onRecordDeleted,
      onFavoriteDeleted,
      // api prop is removed as we import it directly or use it from props if passed (but we removed it from destructuring to fix lint)
      playTime = 0,
      type = 'record',
      style,
      index = 0,
      ...rest
    }: VideoCardProps,
    ref
  ) => {
    const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
    const colors = Colors[colorScheme];

    // Reanimated Shared Values
    const isFocusedSV = useSharedValue(0);
    const fadeSV = useSharedValue(0);

    // JS State refs for logic that doesn't need re-render
    const { deviceType: hookDeviceType } = useResponsiveLayout();
    const deviceType = rest.deviceType ?? hookDeviceType;

    const isCompleted = rest.isCompleted ?? (progress !== undefined && progress >= 0.95);
    const isEpisodeFinished = rest.isEpisodeFinished;
    const isContinueWatching = progress !== undefined && progress > 0;
    const relativeTime = formatRelativeTime(lastPlayed);

    const { handlePress, handleLongPress } = useVideoCardInteractions({
      id,
      source,
      title,
      type,
      progress,
      playTime,
      episodeIndex,
      totalEpisodes,
      isCompleted,
      isEpisodeFinished,
      onRecordDeleted,
      onFavoriteDeleted,
      mediaType: rest.mediaType,
    });

    // Guard against re-triggering entrance animation on re-renders (e.g. tab switches)
    const hasAnimated = useRef(false);
    useEffect(() => {
      if (hasAnimated.current) return;
      hasAnimated.current = true;
      if (index < 8) {
        fadeSV.value = withDelay(index * 30, withTiming(1, { duration: 250 }));
      } else {
        fadeSV.value = 1;
      }
    }, [fadeSV, index]);

    const animatedStyle = useAnimatedStyle(() => {
      const scale = isFocusedSV.value ? 1.05 : 1;
      return {
        // Fast, smooth timing curve for TV performance
        transform: [{ scale: withTiming(scale, { duration: 120 }) }],
        opacity: fadeSV.value,
        zIndex: isFocusedSV.value ? 999 : 1,
      };
    });

    const overlayStyle = useAnimatedStyle(() => {
      return {
        opacity: withTiming(isFocusedSV.value ? 1 : 0, { duration: 120 }),
      };
    });

    const handleFocus = useCallback(() => {
      isFocusedSV.value = 1;
      if (onFocus) {
        // onFocus might trigger parent state update, so keep it in JS
        onFocus({ id, poster, title, index });
      }
    }, [onFocus, isFocusedSV, id, poster, title, index]);

    const handleBlur = useCallback(() => {
      isFocusedSV.value = 0;
    }, [isFocusedSV]);

    // Use handleLongPress from hook directly if no custom prop
    const onLongPressHandler = onLongPress || handleLongPress;

    let progressText = '';
    if (isCompleted) {
      progressText = '已看完';
    } else if (isEpisodeFinished && totalEpisodes && episodeIndex && episodeIndex < totalEpisodes) {
      progressText = `续播第 ${episodeIndex + 1} 集`;
    } else if (progress !== undefined) {
      const percent = `${Math.round(progress * 100)}%`;
      if (episodeIndex && (totalEpisodes === undefined || totalEpisodes > 1)) {
        progressText = `第${episodeIndex}集 · 已看${percent}`;
      } else {
        progressText = `已看${percent}`;
      }
    }

    // Use the module-level cached styles instead of recreating on every render
    const styles = stylesCache[colorScheme];
    const imageSource = useMemo(() => {
      const authCookie = useAuthStore.getState().authCookie;
      return {
        uri: api.getImageProxyUrl(poster),
        headers: authCookie ? { Cookie: authCookie } : undefined,
        width: 200,
      };
    }, [poster]);

    return (
      <Reanimated.View style={[styles.wrapper, animatedStyle, style]}>
        <Pressable
          ref={ref}
          android_ripple={Platform.isTV || deviceType !== 'tv' ? { color: 'transparent' } : { color: colors.link }}
          onPress={handlePress}
          onLongPress={onLongPressHandler}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={styles.pressable}
          delayLongPress={1000}
          {...rest}
        >
          <View style={styles.card}>
            <Image
              source={imageSource}
              style={styles.poster}
              contentFit="cover"
              recyclingKey={poster}
              cachePolicy="memory-disk"
              priority={index < 8 ? "high" : "normal"}
            />

            {/* Overlay is always mounted, opacity controlled by SharedValue */}
            <Reanimated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
              {isContinueWatching && (
                <View style={styles.continueWatchingBadge}>
                  {isCompleted ? (
                    <RotateCcw size={16} color={colors.text} />
                  ) : (
                    <Play size={16} color={colors.text} fill={colors.text} />
                  )}
                  <ThemedText style={styles.continueWatchingText}>
                    {isCompleted ? '重新播放' : '继续观看'}
                  </ThemedText>
                </View>
              )}
            </Reanimated.View>

            {isContinueWatching && (
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.min(Math.round((progress || 0) * 100), 100)}%`,
                      backgroundColor: isCompleted ? colors.tint : colors.primary,
                    },
                  ]}
                />
              </View>
            )}

            {rate && (
              <View style={styles.ratingContainer}>
                <Star size={12} color={colors.tint} fill={colors.tint} />
                <ThemedText style={styles.ratingText}>{rate}</ThemedText>
              </View>
            )}
            {year && (
              <View style={styles.yearBadge}>
                <Text style={styles.badgeText}>{year}</Text>
              </View>
            )}
            {sourceName && (
              <View style={styles.sourceNameBadge}>
                <Text style={styles.badgeText}>{sourceName}</Text>
              </View>
            )}
          </View>
          <View style={styles.infoContainer}>
            <ThemedText numberOfLines={2}>{title}</ThemedText>
            {isContinueWatching && (
              <View style={styles.infoRow}>
                <ThemedText style={isCompleted ? styles.completedLabel : styles.continueLabel}>
                  {progressText}
                </ThemedText>
                {relativeTime && (
                  <ThemedText style={styles.timeLabel}>{relativeTime}</ThemedText>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </Reanimated.View>
    );
  }
);

VideoCard.displayName = "VideoCard";

const CARD_WIDTH = 160;
const CARD_HEIGHT = 240;

const createStyles = (colors: typeof Colors.dark) => StyleSheet.create({
  wrapper: {
    marginHorizontal: 8,
  },
  pressable: {
    width: CARD_WIDTH + 20,
    height: CARD_HEIGHT + 60,
    justifyContent: 'center',
    alignItems: "center",
    overflow: "visible",
  },
  card: {
    marginTop: 10,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
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
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  infoContainer: {
    width: CARD_WIDTH,
    marginTop: 8,
    alignItems: "flex-start",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 2,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
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
    fontSize: 12,
    fontWeight: "bold",
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  continueWatchingText: {
    color: colors.text,
    marginLeft: 5,
    fontSize: 12,
    fontWeight: "bold",
  },
  continueLabel: {
    color: colors.primary,
    fontSize: 12,
  },
  completedLabel: {
    color: colors.tint,
    fontSize: 12,
    fontWeight: '600',
  },
  timeLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
});

const stylesCache = {
  dark: createStyles(Colors.dark),
  light: createStyles(Colors.light),
};

// Module-level style cache: create styles once per color scheme, not per component instance

/**
 * 优化的 Memo 比较逻辑：只比较 UI 相关的关键数据
 */
const areEqual = createShallowEqualComparator<VideoCardProps>([
  'id',
  'title',
  'poster',
  'sourceName',
  'progress',
  'rate',
  'year',
  'episodeIndex',
  'totalEpisodes',
  'lastPlayed',
  'playTime'
]);

export default React.memo(VideoCard, areEqual);
