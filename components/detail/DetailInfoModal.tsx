import React, { memo } from "react";
import { Modal, View, StyleSheet, ScrollView, TouchableWithoutFeedback } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { FadeInImage } from "@/components/FadeInImage";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Colors } from "@/constants/Colors";
import { SearchResultWithResolution } from "@/types";

export interface DetailInfoModalProps {
  visible: boolean;
  onClose: () => void;
  detail: SearchResultWithResolution | null;
  colors: typeof Colors.dark;
}

export const DetailInfoModal: React.FC<DetailInfoModalProps> = memo(({
  visible,
  onClose,
  detail,
  colors,
}) => {
  const { deviceType } = useResponsiveLayout();
  const isTV = deviceType === "tv";

  if (!detail) return null;

  const styles = createStyles(deviceType, colors);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Header section with poster and title/badges */}
              <View style={styles.header}>
                {detail.poster ? (
                  <FadeInImage
                    source={{ uri: detail.poster }}
                    style={styles.poster}
                  />
                ) : null}
                <View style={styles.titleContainer}>
                  <ThemedText style={styles.title} numberOfLines={2}>
                    {detail.title}
                  </ThemedText>

                  <View style={styles.badgeRow}>
                    {detail.year ? (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>{detail.year}</ThemedText>
                      </View>
                    ) : null}
                    {detail.type_name || detail.type ? (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>{detail.type_name || detail.type}</ThemedText>
                      </View>
                    ) : null}
                    {detail.resolution ? (
                      <View style={[styles.badge, styles.resolutionBadge]}>
                        <ThemedText style={styles.badgeText}>{detail.resolution}</ThemedText>
                      </View>
                    ) : null}
                    {detail.source_name ? (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>{detail.source_name}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Scrollable details */}
              <ScrollView
                style={styles.contentScroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                focusable={isTV}
                hasTVPreferredFocus={isTV}
              >
                {/* Meta details (director, actors, etc.) */}
                {((detail as any).director || (detail as any).actor || detail.class) && (
                  <View style={styles.metaSection}>
                    {(detail as any).director ? (
                      <View style={styles.metaRow}>
                        <ThemedText style={styles.metaLabel}>导演：</ThemedText>
                        <ThemedText style={styles.metaValue}>{(detail as any).director}</ThemedText>
                      </View>
                    ) : null}
                    {(detail as any).actor ? (
                      <View style={styles.metaRow}>
                        <ThemedText style={styles.metaLabel}>主演：</ThemedText>
                        <ThemedText style={styles.metaValue}>{(detail as any).actor}</ThemedText>
                      </View>
                    ) : null}
                    {detail.class ? (
                      <View style={styles.metaRow}>
                        <ThemedText style={styles.metaLabel}>类型：</ThemedText>
                        <ThemedText style={styles.metaValue}>{detail.class}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Synopsis section */}
                <View style={styles.synopsisSection}>
                  <ThemedText style={styles.sectionTitle}>剧情简介</ThemedText>
                  <ThemedText style={styles.description}>
                    {detail.desc && detail.desc.trim().length > 0
                      ? detail.desc.trim()
                      : "暂无简介信息。"}
                  </ThemedText>
                </View>
              </ScrollView>

              {/* Bottom hint */}
              <View style={styles.footerHint}>
                <ThemedText style={styles.footerHintText}>
                  {isTV ? "按【返回键】返回详情页" : "点击空白处或按返回键关闭"}
                </ThemedText>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

DetailInfoModal.displayName = "DetailInfoModal";

const createStyles = (deviceType: string, colors: typeof Colors.dark) => {
  const isTV = deviceType === "tv";
  const isMobile = deviceType === "mobile";

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.82)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalCard: {
      width: isMobile ? "92%" : isTV ? 680 : 580,
      maxHeight: isMobile ? "82%" : "85%",
      backgroundColor: colors.background,
      borderRadius: isTV ? 16 : 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      padding: isTV ? 28 : isMobile ? 18 : 22,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255, 255, 255, 0.1)",
    },
    poster: {
      width: isTV ? 80 : 64,
      height: isTV ? 116 : 94,
      borderRadius: 8,
      marginRight: 14,
      backgroundColor: colors.border,
    },
    titleContainer: {
      flex: 1,
      justifyContent: "center",
    },
    title: {
      fontSize: isTV ? 22 : isMobile ? 18 : 20,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 8,
    },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    badge: {
      backgroundColor: "rgba(255, 255, 255, 0.12)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    resolutionBadge: {
      backgroundColor: colors.primary,
    },
    badgeText: {
      fontSize: isTV ? 13 : 11,
      color: colors.text,
      fontWeight: "600",
    },
    contentScroll: {
      marginTop: 12,
      maxHeight: isTV ? 400 : 340,
    },
    scrollContent: {
      paddingBottom: 12,
    },
    metaSection: {
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255, 255, 255, 0.08)",
      gap: 6,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    metaLabel: {
      fontSize: isTV ? 15 : 13,
      fontWeight: "600",
      color: colors.icon,
      width: isTV ? 60 : 50,
    },
    metaValue: {
      flex: 1,
      fontSize: isTV ? 15 : 13,
      color: colors.text,
      lineHeight: isTV ? 22 : 18,
    },
    synopsisSection: {
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: isTV ? 17 : 15,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: isTV ? 15 : 13,
      lineHeight: isTV ? 26 : 22,
      color: "rgba(255, 255, 255, 0.85)",
    },
    footerHint: {
      marginTop: 12,
      paddingTop: 8,
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: "rgba(255, 255, 255, 0.06)",
    },
    footerHintText: {
      fontSize: isTV ? 13 : 11,
      color: colors.icon,
    },
  });
};
