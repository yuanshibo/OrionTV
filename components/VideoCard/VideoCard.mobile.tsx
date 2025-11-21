import React, { useState, useEffect, useRef, forwardRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, useColorScheme } from "react-native";
import { Image } from 'expo-image';
import { useRouter } from "expo-router";
import { Star, Play } from "lucide-react-native";
import { ContentApi } from "@/services/api";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { DeviceUtils } from "@/utils/DeviceUtils";
import { useVideoCardLogic } from "./useVideoCardLogic";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('VideoCardMobile');

interface VideoCardMobileProps extends React.ComponentProps<typeof TouchableOpacity> {
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
  onFavoriteDeleted?: () => void;
  api: ContentApi;
  type?: 'record' | 'favorite';
}

const VideoCardMobile = forwardRef<View, VideoCardMobileProps>(
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
      onFavoriteDeleted,
      api,
      playTime = 0,
      type = 'record',
    }: VideoCardMobileProps,
    ref
  ) => {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'dark';
    const colors = Colors[colorScheme];
    const { cardWidth, cardHeight, spacing } = useResponsiveLayout();
    const [fadeAnim] = useState(new Animated.Value(0));
    const fadeInAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    const longPressTriggered = useRef(false);

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

    useEffect(() => {
      fadeInAnimationRef.current?.stop();
      const animation = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: DeviceUtils.getAnimationDuration(300),
        delay: Math.random() * 100,
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
      };
    }, []);

    const handleLongPress = () => {
      if (type === 'record' && progress === undefined) return;

      longPressTriggered.current = true;
      showDeleteAlert(() => {
        longPressTriggered.current = false;
      });
    };

    const isContinueWatching = progress !== undefined && progress > 0 && progress < 1;

    const styles = useMemo(() => createMobileStyles(cardWidth, cardHeight, spacing, colors), [cardWidth, cardHeight, spacing, colors]);

    return (
      <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]} ref={ref}>
        <TouchableOpacity
          onPress={handlePress}
          onLongPress={handleLongPress}
          style={styles.pressable}
          activeOpacity={0.8}
          delayLongPress={800}
        >
          <View style={styles.card}>
            <Image
              source={{ uri: api.getImageProxyUrl(poster) }}
              style={styles.poster}
              contentFit="cover"
              transition={200}
              onError={(e) => logger.warn(`Image load failed for ${title}:`, e.error, "URL:", api.getImageProxyUrl(poster))}
            />
            
            {isContinueWatching && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(progress || 0) * 100}%` }]} />
              </View>
            )}

            {isContinueWatching && (
              <View style={styles.continueWatchingBadge}>
                <Play size={12} color={colors.text} fill={colors.text} />
                <Text style={styles.continueWatchingText}>继续</Text>
              </View>
            )}

            {rate && (
              <View style={styles.ratingContainer}>
                <Star size={10} color={colors.tint} fill={colors.tint} />
                <Text style={styles.ratingText}>{rate}</Text>
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
            <ThemedText numberOfLines={2} style={styles.title}>{title}</ThemedText>
            {isContinueWatching && (
              <ThemedText style={styles.continueLabel} numberOfLines={1}>
                第{episodeIndex! + 1}集 {Math.round((progress || 0) * 100)}%
              </ThemedText>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

VideoCardMobile.displayName = "VideoCardMobile";

const createMobileStyles = (cardWidth: number, cardHeight: number, spacing: number, colors: (typeof Colors.dark) | (typeof Colors.light)) => {
  return StyleSheet.create({
    wrapper: {
      width: cardWidth,
      marginBottom: spacing,
    },
    pressable: {
      alignItems: 'flex-start',
    },
    card: {
      width: cardWidth,
      height: cardHeight,
      borderRadius: 8,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    poster: {
      width: "100%",
      height: "100%",
    },
    progressContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
    },
    progressBar: {
      height: 3,
      backgroundColor: colors.primary,
    },
    continueWatchingBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
    },
    continueWatchingText: {
      color: colors.text,
      marginLeft: 3,
      fontSize: 10,
      fontWeight: "bold",
    },
    ratingContainer: {
      position: "absolute",
      top: 6,
      right: 6,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    ratingText: {
      color: colors.tint,
      fontSize: 10,
      fontWeight: "bold",
      marginLeft: 2,
    },
    yearBadge: {
      position: "absolute",
      bottom: 24,
      right: 6,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    sourceNameBadge: {
      position: "absolute",
      bottom: 6,
      left: 6,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    badgeText: {
      color: colors.text,
      fontSize: 9,
      fontWeight: "500",
    },
    infoContainer: {
      width: cardWidth,
      marginTop: 6,
      paddingHorizontal: 2,
    },
    title: {
      fontSize: 13,
      lineHeight: 16,
      marginBottom: 2,
    },
    continueLabel: {
      color: colors.primary,
      fontSize: 11,
    },
  });
};

export default React.memo(VideoCardMobile);
