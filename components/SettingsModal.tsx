import React, { useState, useEffect, useRef } from "react";
import { Modal, View, Text, TextInput, StyleSheet, useColorScheme } from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { useSettingsStore } from "@/stores/settingsStore";
import { StyledButton } from "./StyledButton";

export const SettingsModal: React.FC = () => {
  const { isModalVisible, hideModal, apiBaseUrl, setApiBaseUrl, saveSettings, loadSettings } = useSettingsStore();

  const [isInputFocused, setIsInputFocused] = useState(false);
  const colorScheme = useColorScheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isModalVisible) {
      loadSettings();
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isModalVisible, loadSettings]);

  const handleSave = () => {
    saveSettings();
  };

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.6)",
    },
    modalContent: {
      width: "80%",
      maxWidth: 500,
      padding: 24,
      borderRadius: 12,
      elevation: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 20,
      textAlign: "center",
    },
    input: {
      height: 50,
      borderWidth: 2,
      borderRadius: 8,
      paddingHorizontal: 15,
      fontSize: 16,
      marginBottom: 24,
      backgroundColor: colorScheme === "dark" ? "#3a3a3c" : "#f0f0f0",
      color: colorScheme === "dark" ? "white" : "black",
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
    buttonContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    button: {
      flex: 1,
      marginHorizontal: 8,
    },
    buttonText: {
      fontSize: 18,
    },
  });

  return (
    <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={hideModal}>
      <View style={styles.modalContainer}>
        <ThemedView style={styles.modalContent}>
          <ThemedText style={styles.title}>设置</ThemedText>
          <TextInput
            ref={inputRef}
            style={[styles.input, isInputFocused && styles.inputFocused]}
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            placeholder="输入 API 地址"
            placeholderTextColor={colorScheme === "dark" ? "#888" : "#555"}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
          />
          <View style={styles.buttonContainer}>
            <StyledButton
              text="取消"
              onPress={hideModal}
              style={styles.button}
              textStyle={styles.buttonText}
              variant="default"
            />
            <StyledButton
              text="保存"
              onPress={handleSave}
              style={styles.button}
              textStyle={styles.buttonText}
              variant="primary"
            />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
};
