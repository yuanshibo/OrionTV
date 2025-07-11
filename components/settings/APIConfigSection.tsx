import React, { useState, useRef } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSettingsStore } from "@/stores/settingsStore";

interface APIConfigSectionProps {
  onChanged: () => void;
}

export const APIConfigSection: React.FC<APIConfigSectionProps> = ({ onChanged }) => {
  const { apiBaseUrl, setApiBaseUrl } = useSettingsStore();
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleUrlChange = (url: string) => {
    setApiBaseUrl(url);
    onChanged();
  };

  return (
    <ThemedView style={styles.section}>
      <View style={styles.inputContainer}>
        <ThemedText style={styles.sectionTitle}>API 地址</ThemedText>
        <TextInput
          ref={inputRef}
          style={[styles.input, isInputFocused && styles.inputFocused]}
          value={apiBaseUrl}
          onChangeText={handleUrlChange}
          placeholder="输入 API 地址"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
        />
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  section: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: "#ccc",
  },
  input: {
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: "#3a3a3c",
    color: "white",
    borderColor: "transparent",
  },
  inputFocused: {
    borderColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
});
