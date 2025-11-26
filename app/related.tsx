
import React from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import RelatedSeries from '@/components/RelatedSeries';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export default function PostPlayScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const { spacing } = useResponsiveLayout();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',

      padding: spacing / 2,
      marginBottom: spacing,
    },
  });

  return (
    <ThemedView style={styles.container}>
      {title && <RelatedSeries title={title} autoFocus={true} />}
    </ThemedView>
  );
}
