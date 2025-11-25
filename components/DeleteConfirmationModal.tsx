import React from "react";
import { Modal, View, StyleSheet, Text } from "react-native";
import { useModalStore } from "@/stores/modalStore";
import { StyledButton } from "@/components/StyledButton";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Colors } from "@/constants/Colors";

export const DeleteConfirmationModal = () => {
    const { isVisible, title, message, onConfirm, onCancel, hideModal } = useModalStore();
    const { deviceType, spacing } = useResponsiveLayout();
    const isTV = deviceType === 'tv';

    const handleConfirm = () => {
        onConfirm();
        hideModal();
    };

    const handleCancel = () => {
        onCancel();
        hideModal();
    };

    if (!isVisible) return null;

    const styles = createStyles(deviceType, spacing);

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isVisible}
            onRequestClose={handleCancel}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <Text style={styles.modalText}>{message}</Text>
                    <View style={styles.buttonContainer}>
                        <StyledButton
                            text="取消"
                            onPress={handleCancel}
                            style={styles.button}
                            variant="ghost"
                        />
                        <StyledButton
                            text="删除"
                            onPress={handleConfirm}
                            style={[styles.button, styles.deleteButton]}
                            hasTVPreferredFocus={isTV} // Focus on Delete button by default on TV
                            variant="primary"
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (deviceType: string, spacing: number) => {
    const isMobile = deviceType === 'mobile';
    const isTV = deviceType === 'tv';

    return StyleSheet.create({
        centeredView: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
        },
        modalView: {
            margin: 20,
            backgroundColor: Colors.dark.background,
            borderRadius: 20,
            padding: 35,
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            width: isMobile ? '80%' : 500,
            maxWidth: 600,
            borderWidth: 1,
            borderColor: Colors.dark.border,
        },
        modalTitle: {
            fontSize: isTV ? 24 : 20,
            fontWeight: "bold",
            marginBottom: 15,
            textAlign: "center",
            color: Colors.dark.text,
        },
        modalText: {
            marginBottom: 25,
            textAlign: "center",
            color: Colors.dark.text,
            fontSize: isTV ? 18 : 16,
        },
        buttonContainer: {
            flexDirection: "row",
            justifyContent: "space-around",
            width: "100%",
        },
        button: {
            minWidth: 100,
            marginHorizontal: 10,
        },
        deleteButton: {
            backgroundColor: '#ff4444', // Red for delete
        }
    });
};
