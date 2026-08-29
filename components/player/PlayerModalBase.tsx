import React from "react";
import { View, Text, StyleSheet, Modal, StyleProp, ViewStyle, TouchableWithoutFeedback } from "react-native";

export interface PlayerModalBaseProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  variant?: "drawer" | "bottom";
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * PlayerModalBase
 *
 * Unified modal container for in-player drawers and overlays (episodes, sources, playback speed).
 */
export const PlayerModalBase: React.FC<PlayerModalBaseProps> = ({
  visible,
  onClose,
  title,
  width = 500,
  variant = "drawer",
  headerExtra,
  children,
  contentStyle,
}) => {
  const isDrawer = variant === "drawer";

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.modalContainer, isDrawer ? styles.drawerContainer : styles.bottomContainer]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                isDrawer ? { width } : styles.bottomContent,
                contentStyle,
              ]}
            >
              <Text style={styles.modalTitle}>{title}</Text>
              {headerExtra}
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  drawerContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  bottomContainer: {
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 20,
  },
  bottomContent: {
    height: "auto",
    maxHeight: "80%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#1f2937",
  },
  modalTitle: {
    color: "white",
    marginBottom: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
  },
});
