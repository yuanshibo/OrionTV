import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

export const createResponsiveStyles = (deviceType: string, spacing: number, colors: typeof Colors.dark) => {
  const isTV = deviceType === 'tv';
  const isTablet = deviceType === 'tablet';
  const isMobile = deviceType === 'mobile';

  return StyleSheet.create({
    scrollContainer: {
      paddingHorizontal: spacing,
      paddingBottom: spacing,
    },
    mobileTopContainer: {
      paddingTop: spacing,
      paddingBottom: spacing / 2,
    },
    mobilePoster: {
      width: '100%',
      height: 280,
      borderRadius: 8,
      alignSelf: 'center',
      marginBottom: spacing,
    },
    mobileInfoContainer: {
      flex: 1,
    },
    descriptionContainer: {
      paddingBottom: spacing,
    },
    topContainer: {
      flexDirection: "row",
      paddingTop: spacing,
      paddingBottom: spacing,
    },
    poster: {
      width: isTV ? 200 : 160,
      height: isTV ? 300 : 240,
      borderRadius: 8,
    },
    infoContainer: {
      flex: 1,
      marginLeft: spacing,
      justifyContent: "flex-start",
    },
    descriptionScrollView: {
      height: 150,
    },
    titleContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing / 2,
    },
    title: {
      paddingTop: 16,
      fontSize: isMobile ? 20 : isTablet ? 24 : 28,
      fontWeight: "bold",
      flexShrink: 1,
      color: colors.text,
      height: 45,
    },
    favoriteButton: {
      padding: 10,
      marginLeft: 10,
      backgroundColor: "transparent",
    },
    playButton: {
      marginTop: spacing / 6,
      alignSelf: isMobile ? "stretch" : "flex-start",
      minWidth: isTV ? 130 : isTablet ? 140 : 140,
    },
    playButtonText: {
      fontSize: isMobile ? 14 : isTablet ? 15 : 15,
      fontWeight: "600",
    },
    metaContainer: {
      flexDirection: "row",
      marginBottom: spacing / 2,
    },
    metaText: {
      color: colors.icon,
      marginRight: spacing / 2,
      fontSize: isMobile ? 12 : 14,
    },
    description: {
      fontSize: isMobile ? 13 : 14,
      color: colors.text,
      lineHeight: isMobile ? 18 : 22,
    },
    bottomContainer: {
      // paddingHorizontal removed, handled by contentContainerStyle
    },
    sourcesContainer: {
      marginTop: spacing,
    },
    sourcesTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing / 2,
    },
    sourcesTitle: {
      fontSize: isMobile ? 16 : isTablet ? 18 : 20,
      fontWeight: "bold",
      color: colors.text,
    },
    sourceList: {
      flexDirection: "row",
      flexWrap: isMobile ? "wrap" : "nowrap",
    },
    sourceButton: {
      margin: isMobile ? 4 : 8,
      minHeight: isMobile ? 36 : 44,
    },
    sourceButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    sourceButtonText: {
      color: colors.text,
      fontSize: isMobile ? 14 : 16,
    },
    badge: {
      backgroundColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 8,
    },
    badgeText: {
      color: colors.text,
      fontSize: isMobile ? 10 : 12,
      fontWeight: "bold",
      paddingBottom: 2.5,
    },
    selectedBadge: {
      backgroundColor: colors.background,
    },
    sourceNameText: {
      color: colors.text,
      fontSize: isMobile ? 14 : 14,
      fontWeight: "600"
    },
    sourceMetaText: {
      color: colors.text,
      fontSize: isMobile ? 12 : 12,
      marginLeft: 4,
      textAlign: 'center',
    },
    episodesContainer: {
      marginTop: spacing,
      paddingBottom: spacing * 2,
    },
    episodesTitle: {
      fontSize: isMobile ? 16 : isTablet ? 18 : 20,
      fontWeight: "bold",
      marginBottom: spacing / 4,
      color: colors.text,
    },
    episodeList: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    episodeButton: {
      margin: isMobile ? 3 : 5,
      minHeight: isMobile ? 32 : 36,
      // width is handled by FlashList numColumns and renderItem padding
    },
    episodeButtonText: {
      color: colors.text,
      fontSize: isMobile ? 12 : 11,
      textAlign: 'center',
    },
  });
};
