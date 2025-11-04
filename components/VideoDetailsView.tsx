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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 48, // Add horizontal padding
    paddingVertical: 16,
  },
  scrollContent: {
    paddingTop: 80,
    paddingBottom: 80,
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

export function VideoDetailsView({ showDetails }: VideoDetailsViewProps) {
  const detail = useDetailStore((state) => state.detail);
  const animatedOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedOpacity, {
      toValue: showDetails ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showDetails, animatedOpacity]);

  if (!showDetails || !detail) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: animatedOpacity }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.title}>{detail.title}</ThemedText>
        <View style={styles.metaContainer}>
          {detail.year && <ThemedText style={styles.metaText}>{detail.year}</ThemedText>}
          {detail.type_name && <ThemedText style={styles.metaText}>{detail.type_name}</ThemedText>}
        </View>
        <ThemedText style={styles.description}>{detail.desc}</ThemedText>
      </ScrollView>
    </Animated.View>
  );
}
