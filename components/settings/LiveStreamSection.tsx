import React from 'react';
import { StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

interface LiveStreamSectionProps {
  onChanged: () => void;
}

export const LiveStreamSection: React.FC<LiveStreamSectionProps> = ({ onChanged }) => {
  return (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle}>直播源配置</ThemedText>
      <ThemedText style={styles.placeholder}>直播源配置功能即将上线</ThemedText>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  section: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
});