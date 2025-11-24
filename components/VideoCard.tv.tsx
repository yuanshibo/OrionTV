import React, { useCallback, forwardRef, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Platform, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { Star, Play } from "lucide-react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay
} from "react-native-reanimated";
import { API } from "@/services/api";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import useAuthStore from "@/stores/authStore";
import { useVideoCardInteractions } from "@/hooks/useVideoCardInteractions";

interface VideoCardProps extends React.ComponentProps<typeof TouchableOpacity> {
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
  onLongPress?: () => void;
  onRecordDeleted?: () => void;
  onFavoriteDeleted?: () => void;
  api: API;
  type?: 'record' | 'favorite';
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
      onFocus,
      onLongPress,
      onRecordDeleted,
      onFavoriteDeleted,
      api,
      playTime = 0,
      type = 'record',
      ...rest
    }: VideoCardProps,
    ref
  ) => {
    const colorScheme = useColorScheme() ?? 'dark';
    const colors = Colors[colorScheme];

    // Reanimated Shared Values
    const isFocusedSV = useSharedValue(0);
    const fadeSV = useSharedValue(0);

    // JS State refs for logic that doesn't need re-render
    const deviceType = useResponsiveLayout().deviceType;

    const { handlePress, handleLongPress } = useVideoCardInteractions({
      id,
      source,
      title,
      type,
      progress,
      playTime,
      episodeIndex,
      onRecordDeleted,
      onFavoriteDeleted,
    });

    useEffect(() => {
      // Entrance Animation
      fadeSV.value = withDelay(Math.random() * 200, withTiming(1, { duration: 400 }));
    }, [fadeSV]);

    const animatedStyle = useAnimatedStyle(() => {
      const scale = isFocusedSV.value ? 1.05 : 1;
      return {
        transform: [{ scale: withSpring(scale, { damping: 15, stiffness: 200 }) }],
        opacity: fadeSV.value,
        zIndex: isFocusedSV.value ? 999 : 1,
      };
    });

    const overlayStyle = useAnimatedStyle(() => {
      return {
        opacity: withTiming(isFocusedSV.value ? 1 : 0, { duration: 200 }),
      };
    });

    const handleFocus = useCallback(() => {
      isFocusedSV.value = 1;
      if (onFocus) {
         // onFocus might trigger parent state update, so keep it in JS
         onFocus();
      }
    }, [onFocus, isFocusedSV]);

    const handleBlur = useCallback(() => {
      isFocusedSV.value = 0;
    }, [isFocusedSV]);

    // Use handleLongPress from hook directly if no custom prop
    const onLongPressHandler = onLongPress || handleLongPress;

    const isContinueWatching = progress !== undefined && progress > 0 && progress < 1;
    const styles = useMemo(() => createStyles(colors), [colors]);
    const authCookie = useAuthStore((state) => state.authCookie);
    const imageSource = useMemo(
      () => ({
        uri: api.getImageProxyUrl(poster),
        headers: authCookie ? { Cookie: authCookie } : undefined,
      }),
      [poster, authCookie, api]
    );

    return (
      <Reanimated.View style={[styles.wrapper, animatedStyle]}>
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
            <Image source={imageSource} style={styles.poster} contentFit="cover" transition={300} />

            {/* Overlay is always mounted, opacity controlled by SharedValue */}
            <Reanimated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
              {isContinueWatching && (
                <View style={styles.continueWatchingBadge}>
                  <Play size={16} color={colors.text} fill={colors.text} />
                  <ThemedText style={styles.continueWatchingText}>继续观看</ThemedText>
                </View>
              )}
            </Reanimated.View>

            {isContinueWatching && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(progress || 0) * 100}%` }]} />
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
            <ThemedText numberOfLines={1}>{title}</ThemedText>
            {isContinueWatching && (
              <View style={styles.infoRow}>
                <ThemedText style={styles.continueLabel}>
                  第{episodeIndex}集 已观看 {Math.round((progress || 0) * 100)}%
                </ThemedText>
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
    ...StyleSheet.absoluteFillObject,
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
    width: "100%",
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
});

export default React.memo(VideoCard);
