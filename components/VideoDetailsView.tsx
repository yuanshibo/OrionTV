import React from 'react';
import { View, ScrollView, StyleSheet, Animated } from 'react-native';
import { ThemedText } from './ThemedText';
import useDetailStore from '@/stores/detailStore';

interface VideoDetailsViewProps {
  showDetails: boolean;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 48, // Add horizontal padding
    paddingVertical: 16,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center', // Center content horizontally
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center', // Align items vertically
    gap: 16,
    marginBottom: 16,
  },
  metaText: {
    fontSize: 16,
    color: '#ccc',
  },
  description: {
    fontSize: 18,
    color: 'white',
    lineHeight: 28,
    textAlign: 'left', // Center description text
  },
});

export const VideoDetailsView = React.memo(({ showDetails }: VideoDetailsViewProps) => {
  const detail = useDetailStore((state) => state.detail);
  const animatedOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedOpacity, {
      toValue: showDetails ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showDetails, animatedOpacity]);

  // Optimization: Even if showDetails is false, we might be rendering hidden content.
  // The original code returned null if !showDetails or !detail.
  // Returning null unmounts the component, which means the fade-out animation wouldn't play if `showDetails` became false immediately.
  // Wait, `useNativeDriver` needs the view to exist.
  // If `showDetails` becomes false, `useEffect` triggers animation to 0.
  // BUT if we return `null` immediately below, the component unmounts and animation is lost.
  // The original code: `if (!showDetails || !detail) { return null; }`
  // This logic is flawed for fade-out. It snaps to hidden.
  // To support fade-out, we should keep it mounted until opacity is 0, or simply use `pointerEvents="none"` when hidden.

  // However, unmounting is good for performance when not needed.
  // Let's trust the original intent was "simple toggle" or maybe the parent controls mounting?
  // In `play.tsx`, it is always rendered: `<VideoDetailsView showDetails={showDetails} />`.

  // Improvement: Use `pointerEvents` to disable interaction when hidden, but keep mounted for animation?
  // Or better: Don't return null immediately. Let opacity drive visibility.
  // But if detail is missing, we must return null.

  if (!detail) return null;

  // If we want to support fade out, we shouldn't return null when showDetails is false.
  // We can use a state to track "visible" or just rely on opacity + pointerEvents.

  return (
    <Animated.View
      style={[styles.container, { opacity: animatedOpacity }]}
      pointerEvents={showDetails ? 'auto' : 'none'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.title}>{detail.title}</ThemedText>
        <View style={styles.metaContainer}>
          {detail.year && <ThemedText style={styles.metaText}>{detail.year} </ThemedText>}
          {detail.type_name && <ThemedText style={styles.metaText}>{detail.type_name}</ThemedText>}
        </View>
        <ThemedText style={styles.description}>{detail.desc}</ThemedText>
      </ScrollView>
    </Animated.View>
  );
});

VideoDetailsView.displayName = 'VideoDetailsView';
