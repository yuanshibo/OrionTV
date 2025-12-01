import React, { forwardRef, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, useColorScheme, Text } from "react-native";
import { Image } from "expo-image";
import { Star, Play } from "lucide-react-native";
import Reanimated from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import useAuthStore from "@/stores/authStore";
import { useVideoCardInteractions } from "@/hooks/useVideoCardInteractions";

import { VideoCardMobileProps } from './VideoCard.types';

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
      style,
      ...rest
    }: VideoCardMobileProps,
    ref
  ) => {
    const colorScheme = useColorScheme() ?? 'dark';
    const colors = Colors[colorScheme];
    const { cardWidth, cardHeight, spacing } = useResponsiveLayout();

    const { handlePress, handleLongPress } = useVideoCardInteractions({
      id,
      source,
      title,
      poster,
      type,
      progress,
      playTime,
      episodeIndex,
      onRecordDeleted,
      onFavoriteDeleted,
    });

    const isContinueWatching = progress !== undefined && progress > 0 && progress < 1;

    const styles = useMemo(() => createMobileStyles(cardWidth, cardHeight, spacing, colors), [cardWidth, cardHeight, spacing, colors]);
    const authCookie = useAuthStore((state) => state.authCookie);
    const imageSource = useMemo(
      () => ({
        uri: api.getImageProxyUrl(poster),
        headers: authCookie ? { Cookie: authCookie } : undefined,
        width: 200,
      }),
      [poster, authCookie, api]
    );

    return (
      <Reanimated.View style={[styles.wrapper, style]} ref={ref}>
        <TouchableOpacity
          onPress={handlePress}
          onLongPress={handleLongPress}
          style={styles.pressable}
          activeOpacity={0.8}
          delayLongPress={800}
          {...rest}
        >
          <View style={styles.card}>
            <Image
              source={imageSource}
              style={styles.poster}
              contentFit="cover"
              transition={200}
              recyclingKey={poster}
              cachePolicy="disk"
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
      </Reanimated.View>
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
      flexDirection: "row",
      alignItems: "center",
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
