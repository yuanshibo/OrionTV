import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { View, StyleSheet, Text, ActivityIndicator, useColorScheme } from "react-native";
import { VideoView, useVideoPlayer, VideoPlayer } from "expo-video";
import type {
  VideoPlayerEvents,
  StatusChangeEventPayload,
  PlayingChangeEventPayload,
  TimeUpdateEventPayload,
  SourceLoadEventPayload,
} from "expo-video";
import { useKeepAwake } from "expo-keep-awake";
import { PlaybackState, createInitialPlaybackState } from "@/stores/playerStore";
import { Colors } from "@/constants/Colors";

const PLAYBACK_TIMEOUT = 15000; // 15 seconds

type EventfulVideoPlayer = {
  addListener<K extends keyof VideoPlayerEvents>(eventName: K, listener: VideoPlayerEvents[K]): { remove(): void };
} & VideoPlayer;

export type LivePlayerProps = {
  streamUrl: string | null;
  channelTitle: string | null;
  onPlaybackStatusUpdate: (status: PlaybackState) => void;
};

export default function LivePlayer({ streamUrl, channelTitle, onPlaybackStatusUpdate }: LivePlayerProps) {
  const colorScheme = useColorScheme() ?? "dark";
  const colors = Colors[colorScheme];
  const [isLoading, setIsLoading] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<PlaybackState>(createInitialPlaybackState());
  useKeepAwake();

  const player = useVideoPlayer(streamUrl ?? null, (instance: VideoPlayer) => {
    instance.loop = true;
    instance.keepScreenOnWhilePlaying = true;
    instance.timeUpdateEventInterval = 0.5;
  });

  const emitStatusUpdate = useCallback(
    (updates: Partial<PlaybackState>) => {
      statusRef.current = { ...statusRef.current, ...updates };
      onPlaybackStatusUpdate({ ...statusRef.current });
    },
    [onPlaybackStatusUpdate],
  );

  useEffect(() => {
    statusRef.current = createInitialPlaybackState();
    onPlaybackStatusUpdate({ ...statusRef.current });
  }, [streamUrl, onPlaybackStatusUpdate, player]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (streamUrl) {
      setIsLoading(true);
      setIsTimeout(false);
      timeoutRef.current = setTimeout(() => {
        setIsTimeout(true);
        setIsLoading(false);
      }, PLAYBACK_TIMEOUT);
    } else {
      setIsLoading(false);
      setIsTimeout(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [streamUrl]);

  useEffect(() => {
    if (!player) {
      return undefined;
    }

    const eventedPlayer = player as EventfulVideoPlayer;

    const subscriptions = [
      eventedPlayer.addListener("statusChange", ({ status, error }: StatusChangeEventPayload) => {
        switch (status) {
          case "loading":
            setIsLoading(true);
            setIsTimeout(false);
            emitStatusUpdate({ isLoaded: false, isBuffering: true, error: undefined, didJustFinish: false });
            break;
          case "readyToPlay":
            setIsLoading(false);
            setIsTimeout(false);
            emitStatusUpdate({ isLoaded: true, isBuffering: false, error: undefined });
            try {
              player.play();
            } catch (err) {
              console.warn("[LIVE] Failed to start playback automatically", err);
            }
            break;
          case "idle":
            emitStatusUpdate({ isLoaded: false, isPlaying: false, isBuffering: false });
            break;
          case "error": {
            const message = error?.message ?? "Live playback error";
            setIsLoading(false);
            setIsTimeout(true);
            emitStatusUpdate({
              isLoaded: false,
              isPlaying: false,
              isBuffering: false,
              error: message,
            });
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            break;
          }
          default:
            break;
        }
      }),
      eventedPlayer.addListener("playingChange", ({ isPlaying }: PlayingChangeEventPayload) => {
        if (isPlaying) {
          setIsLoading(false);
          setIsTimeout(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        }
        emitStatusUpdate({ isPlaying, isBuffering: false, didJustFinish: false });
      }),
      eventedPlayer.addListener("timeUpdate", ({ currentTime }: TimeUpdateEventPayload) => {
        emitStatusUpdate({ positionMillis: currentTime * 1000 });
      }),
      eventedPlayer.addListener("sourceLoad", (_payload: SourceLoadEventPayload) => {
        const durationSeconds = player.duration;
        const durationMillis =
          Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds * 1000 : undefined;
        emitStatusUpdate({ durationMillis });
        setIsLoading(false);
        setIsTimeout(false);
        try {
          player.play();
        } catch (err) {
          console.warn("[LIVE] Failed to resume playback after loading source", err);
        }
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [player, emitStatusUpdate]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    video: {
      flex: 1,
      alignSelf: "stretch",
    },
    overlay: {
      position: "absolute",
      top: 20,
      left: 20,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      padding: 10,
      borderRadius: 5,
    },
    title: {
      color: colors.text,
      fontSize: 18,
    },
    messageText: {
      color: colors.text,
      fontSize: 16,
      marginTop: 10,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
  }), [colors]);

  if (!streamUrl) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>按向下键选择频道</Text>
      </View>
    );
  }

  if (isTimeout) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>加载失败，请重试</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={styles.messageText}>加载中...</Text>
        </View>
      )}
      {channelTitle && !isLoading && !isTimeout && (
        <View style={styles.overlay}>
          <Text style={styles.title}>{channelTitle}</Text>
        </View>
      )}
    </View>
  );
}
