import React, { memo, useMemo, useState, useEffect } from "react";
import { StyleSheet, View, Image, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { VideoView, VideoPlayer } from "expo-video";
import { PlayerControls } from "@/components/PlayerControls";
import { SeekingBar } from "@/components/SeekingBar";
import { SearchResultWithResolution } from "@/services/api";
import { VideoViewPropsSubset } from "@/hooks/useVideoHandlers";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("PlayerView");

const ErrorContainer = memo(({ style, message, textStyle }: { style: any; message: string; textStyle: any }) => {
  logger.warn(`[UI] Displaying player error: ${message}`);
  return (
    <View style={style}>
      <Text style={textStyle}>{message}</Text>
    </View>
  );
});
ErrorContainer.displayName = "ErrorContainer";

const createResponsiveStyles = (deviceType: string) => {
  const isMobile = deviceType === "mobile";
  const isTablet = deviceType === "tablet";

  return StyleSheet.create({
    videoContainer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: isMobile || isTablet ? 1 : undefined,
    },
    videoPlayer: { ...StyleSheet.absoluteFillObject },
    posterContainer: { ...StyleSheet.absoluteFillObject },
    posterImage: { flex: 1 },
    overlayContainer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    indicatorContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 20, // Ensure it's on top of other elements
    },
    errorText: {
      color: "white",
      fontSize: 16,
      textAlign: "center",
      paddingHorizontal: 20,
    },
  });
};

interface PlayerViewProps {
  deviceType: "tv" | "mobile" | "tablet";
  detail: SearchResultWithResolution | null;
  error?: string;
  isLoaded: boolean;
  isBuffering: boolean;
  isLoading: boolean;
  isSeeking: boolean;
  isSeekBuffering: boolean;
  currentEpisode?: { url: string; title: string };
  player: VideoPlayer | null;
  videoViewProps: VideoViewPropsSubset;
  showControls: boolean;
  onScreenPress: () => void;
  setShowControls: (show: boolean) => void;
}

const PlayerView = memo((props: PlayerViewProps) => {
  const {
    deviceType,
    detail,
    error,
    isLoaded,
    isBuffering,
    isLoading,
    isSeeking,
    isSeekBuffering,
    currentEpisode,
    player,
    videoViewProps,
    showControls,
    onScreenPress,
    setShowControls,
  } = props;

  const [hasEverBeenLoaded, setHasEverBeenLoaded] = useState(false);

  useEffect(() => {
    // When the media item (show/movie) changes, reset the flag.
    // The ID is the unique identifier for a show/movie.
    setHasEverBeenLoaded(false);
  }, [detail?.id]);

  useEffect(() => {
    // Once the video is loaded, we set the flag and it remains set
    // for subsequent loads (e.g., next episode, source change).
    if (isLoaded && !hasEverBeenLoaded) {
      setHasEverBeenLoaded(true);
    }
  }, [isLoaded, hasEverBeenLoaded]);

  const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType), [deviceType]);
  const shouldShowPoster = Boolean(detail?.poster && !hasEverBeenLoaded && !error);
  const rawShouldShowLoading = Boolean(isLoading || isSeekBuffering || (isLoaded && isBuffering));
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (rawShouldShowLoading) {
      // Delay showing the loading indicator to prevent flicker on fast seeks/buffers
      timeoutId = setTimeout(() => {
        setShowLoading(true);
      }, 200);
    } else {
      // Hide immediately when loading is done
      setShowLoading(false);
    }

    return () => clearTimeout(timeoutId);
  }, [rawShouldShowLoading]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={dynamicStyles.videoContainer}
      onPress={onScreenPress}
      disabled={deviceType !== "tv" && showControls}
    >
      {shouldShowPoster && (
        <View pointerEvents="none" style={dynamicStyles.posterContainer}>
          <Image source={{ uri: detail!.poster }} style={dynamicStyles.posterImage} resizeMode="contain" />
        </View>
      )}

      {error && <ErrorContainer style={dynamicStyles.overlayContainer} message={error} textStyle={dynamicStyles.errorText} />}

      {!error && (
        <>
          {currentEpisode?.url && player && <VideoView player={player} style={dynamicStyles.videoPlayer} {...videoViewProps} />}

          {showLoading && (
            <View style={dynamicStyles.indicatorContainer} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {showControls && deviceType === "tv" && <PlayerControls showControls={showControls} setShowControls={setShowControls} />}

          {isSeeking && !showControls && <SeekingBar />}
        </>
      )}
    </TouchableOpacity>
  );
});

PlayerView.displayName = "PlayerView";
export default PlayerView;
