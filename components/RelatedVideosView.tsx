import React from "react";
import { View, StyleSheet, Animated } from 'react-native';
import RelatedSeries from '@/components/RelatedSeries';

interface RelatedVideosViewProps {
  show: boolean;
  title: string;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export function RelatedVideosView({ show, title }: RelatedVideosViewProps) {
  const animatedOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedOpacity, {
      toValue: show ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [show, animatedOpacity]);

  if (!show) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: animatedOpacity }]}>
      <RelatedSeries title={title} />
    </Animated.View>
  );
}
