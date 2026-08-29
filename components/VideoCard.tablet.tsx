import React, { useState, useEffect, useCallback, useRef, forwardRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { Star, Play } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useImageSource } from "@/hooks/useImageSource";
import { useVideoCardInteractions } from "@/hooks/useVideoCardInteractions";
import { formatProgressText } from "@/utils/formatUtils";
import { DeviceUtils } from "@/utils/DeviceUtils";

import { VideoCardTabletProps } from "./VideoCard.types";

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
      totalEpisodes,
      onFocus,
      onRecordDeleted,
      onFavoriteDeleted,
      api,
      playTime = 0,
      type = "record",
      style,
      ...rest
    }: VideoCardTabletProps,
    ref
  ) => {
    const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
    const colors = Colors[colorScheme];
    const { cardWidth, cardHeight, spacing } = useResponsiveLayout();
    const [fadeAnim] = useState(new Animated.Value(0));
    const [isPressed, setIsPressed] = useState(false);

    const scale = useRef(new Animated.Value(1)).current;
    const fadeInAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
    const scaleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    const isCompleted = rest.isCompleted ?? (progress !== undefined && progress >= 0.95);
    const isEpisodeFinished = rest.isEpisodeFinished;

    const { handlePress, handleLongPress } = useVideoCardInteractions({
      id,
      source,
      title,
      poster,
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

    const isContinueWatching = progress !== undefined && progress > 0 && progress < 1;

    const animatedStyle = {
      transform: [{ scale }],
    };

    const styles = useMemo(() => createTabletStyles(cardWidth, cardHeight, spacing, colors), [cardWidth, cardHeight, spacing, colors]);
    const imageSource = useImageSource(poster, { width: 200 });

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
            <Image source={imageSource} style={styles.poster} contentFit="cover" transition={300} />

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
                  {formatProgressText({ progress, episodeIndex, totalEpisodes, isCompleted, isEpisodeFinished })}
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
      ...StyleSheet.absoluteFill,
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

export default React.memo(VideoCardTablet);
