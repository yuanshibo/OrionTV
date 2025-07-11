import React, { useState, useRef } from 'react';
import { View, TextInput, StyleSheet, Animated } from 'react-native';
import { useTVEventHandler } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { SettingsSection } from './SettingsSection';
import { useSettingsStore } from '@/stores/settingsStore';
import { useButtonAnimation } from '@/hooks/useAnimation';

interface LiveStreamSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const LiveStreamSection: React.FC<LiveStreamSectionProps> = ({ onChanged, onFocus, onBlur }) => {
  const { m3uUrl, setM3uUrl } = useSettingsStore();
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSectionFocused, setIsSectionFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const inputAnimationStyle = useButtonAnimation(isSectionFocused, 1.01);

  const handleUrlChange = (url: string) => {
    setM3uUrl(url);
    onChanged();
  };

  const handleSectionFocus = () => {
    setIsSectionFocused(true);
    onFocus?.();
  };

  const handleSectionBlur = () => {
    setIsSectionFocused(false);
    onBlur?.();
  };

  const handleTVEvent = React.useCallback(
    (event: any) => {
      if (isSectionFocused && event.eventType === "select") {
        inputRef.current?.focus();
      }
    },
    [isSectionFocused]
  );

  useTVEventHandler(handleTVEvent);

  return (
    <SettingsSection focusable onFocus={handleSectionFocus} onBlur={handleSectionBlur}>
      <View style={styles.inputContainer}>
        <ThemedText style={styles.sectionTitle}>直播源地址</ThemedText>
        <Animated.View style={inputAnimationStyle}>
          <TextInput
            ref={inputRef}
            style={[styles.input, isInputFocused && styles.inputFocused]}
            value={m3uUrl}
            onChangeText={handleUrlChange}
            placeholder="输入 M3U 直播源地址"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
          />
        </Animated.View>
      </View>
    </SettingsSection>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 12,
  },
  input: {
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#3a3a3c',
    color: 'white',
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
});