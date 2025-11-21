import React, { useState, useEffect, useCallback, useRef, forwardRef, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Alert, Animated, Platform, useColorScheme } from "react-native";
import { Image } from 'expo-image';
import { useRouter } from "expo-router";
import { Star, Play } from "lucide-react-native";
import { ContentApi } from "@/services/api";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useVideoCardLogic } from "./useVideoCardLogic";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('VideoCardTV');

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
  api: ContentApi;
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
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'dark';
    const colors = Colors[colorScheme];
    const [isFocused, setIsFocused] = useState(false);

    // Optimization: Use useRef for Animated Values to ensure stability and avoid recreation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    const longPressTriggered = useRef(false);

    const fadeInAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
    const scaleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    const deviceType = useResponsiveLayout().deviceType;

    const animatedStyle = {
      transform: [{ scale }],
    };

    const { handlePress: performNavigation, showDeleteAlert } = useVideoCardLogic({
      id,
      source,
      title,
      progress,
      playTime,
      episodeIndex,
      type,
      onRecordDeleted,
      onFavoriteDeleted,
    });

    const handlePress = () => {
      if (longPressTriggered.current) {
        longPressTriggered.current = false;
        return;
      }
      performNavigation();
    };

    const runScaleAnimation = useCallback(
      (toValue: number, config?: Partial<Animated.SpringAnimationConfig>) => {
        scaleAnimationRef.current?.stop();
        const animation = Animated.spring(scale, {
          toValue,
          useNativeDriver: true,
          ...config,
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

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      runScaleAnimation(1.05, { damping: 15, stiffness: 200 });
      onFocus?.();
    }, [runScaleAnimation, onFocus]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      runScaleAnimation(1.0);
    }, [runScaleAnimation]);

    useEffect(() => {
      fadeInAnimationRef.current?.stop();
      const animation = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: Math.random() * 200,
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
      if (onLongPress) {
        onLongPress();
        return;
      }
      if (type === 'record' && progress === undefined) return;

      longPressTriggered.current = true;
      showDeleteAlert(() => {
        longPressTriggered.current = false;
      });
    };

    const isContinueWatching = progress !== undefined && progress > 0 && progress < 1;
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
      <Animated.View style={[styles.wrapper, animatedStyle, { opacity: fadeAnim }]}>
        <Pressable
          ref={ref}
          android_ripple={Platform.isTV || deviceType !== 'tv' ? { color: 'transparent' } : { color: colors.link }}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={({ pressed }) => [
            styles.pressable,
            {
              zIndex: pressed ? 999 : 1,
            },
          ]}
          delayLongPress={1000}
          {...rest}
        >
          <View style={styles.card}>
            <Image
              source={{ uri: api.getImageProxyUrl(poster) }}
              style={styles.poster}
              contentFit="cover"
              transition={200}
              onError={(e) => logger.warn(`Image load failed for ${title} (TV):`, e.error, "URL:", api.getImageProxyUrl(poster))}
            />
            {isFocused && (
              <View style={styles.overlay}>
                {isContinueWatching && (
                  <View style={styles.continueWatchingBadge}>
                    <Play size={16} color={colors.text} fill={colors.text} />
                    <ThemedText style={styles.continueWatchingText}>继续观看</ThemedText>
                  </View>
                )}
              </View>
            )}

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
      </Animated.View>
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
