import React, { memo, useMemo } from "react";
import { StyleSheet, View, Image, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { VideoView, VideoPlayer } from "expo-video";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { PlayerControls } from "@/components/PlayerControls";
import { SeekingBar } from "@/components/SeekingBar";
import { SearchResultWithResolution } from "@/services/api";
import { PlaybackState } from "@/stores/playerStore";
import { VideoViewPropsSubset } from "@/hooks/useVideoHandlers"; // Import the specific type
import Logger from "@/utils/Logger";

const logger = Logger.withTag("PlayerView");

// Helper Components
const LoadingContainer = memo(({ style }: { style: any }) => (
  <View style={style}>
    <VideoLoadingAnimation showProgressBar />
  </View>
));
LoadingContainer.displayName = "LoadingContainer";

const ErrorContainer = memo(({ style, message, textStyle }: { style: any; message: string; textStyle: any }) => {
  logger.error(`[UI] Displaying player error: ${message}`);
  return (
    <View style={style}>
      <Text style={textStyle}>{message}</Text>
    </View>
  );
});
ErrorContainer.displayName = "ErrorContainer";

// Styles
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
    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    seekBufferingIndicator: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 20, // Ensure it's on top
    },
    errorText: {
      color: "white",
      fontSize: 16,
      textAlign: "center",
      paddingHorizontal: 20,
    },
  });
};

// Prop Types
interface PlayerViewProps {
  deviceType: "tv" | "mobile" | "tablet";
  detail: SearchResultWithResolution | null;
  error?: string;
  status: PlaybackState | null;
  isSeeking: boolean;
  isSeekBuffering: boolean;
  currentEpisode?: { url: string; title: string };
  player: VideoPlayer | null;
  videoViewProps: VideoViewPropsSubset; // Use the specific type instead of any
  showControls: boolean;
  onScreenPress: () => void;
  setShowControls: (show: boolean) => void;
}

const PlayerView = memo((props: PlayerViewProps) => {
  const {
    deviceType,
    detail,
    error,
    status,
    isSeeking,
    isSeekBuffering,
    currentEpisode,
    player,
    videoViewProps,
    showControls,
    onScreenPress,
    setShowControls,
  } = props;

  const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType), [deviceType]);
  const shouldShowPoster = Boolean(detail?.poster && !status?.isLoaded && !error && !isSeeking);

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

      {error ? (
        <ErrorContainer style={dynamicStyles.loadingContainer} message={error} textStyle={dynamicStyles.errorText} />
      ) : (
        <>
          {currentEpisode?.url && player ? (
            <VideoView player={player} style={dynamicStyles.videoPlayer} {...videoViewProps} />
          ) : (
            <LoadingContainer style={dynamicStyles.loadingContainer} />
          )}

          {isSeekBuffering && (
            <View style={dynamicStyles.seekBufferingIndicator} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {showControls && deviceType === "tv" && (
            <PlayerControls showControls={showControls} setShowControls={setShowControls} />
          )}

          <SeekingBar />
        </>
      )}
    </TouchableOpacity>
  );
});

PlayerView.displayName = "PlayerView";
export default PlayerView;