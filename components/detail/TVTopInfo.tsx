import React, { memo } from 'react';
import { View, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { Heart } from 'lucide-react-native';
import { FadeInImage } from '@/components/FadeInImage';

interface TVTopInfoProps {
    detail: any;
    isFavorited: boolean;
    toggleFavorite: () => void;
    handlePrimaryPlay: () => void;
    playButtonLabel: string;
    isPlayDisabled: boolean;
    dynamicStyles: any;
    colors: any;
    nextFocusDown?: number | null;
    onFocus?: () => void;
}

export const TVTopInfo = memo(({
    detail,
    isFavorited,
    toggleFavorite,
    handlePrimaryPlay,
    playButtonLabel,
    isPlayDisabled,
    dynamicStyles,
    colors,
    nextFocusDown,
    onFocus
}: TVTopInfoProps) => {
    return (
        <View style={dynamicStyles.topContainer}>
            <FadeInImage source={{ uri: detail.poster }} style={dynamicStyles.poster} />
            <View style={dynamicStyles.infoContainer}>
                <View style={dynamicStyles.titleContainer}>
                    <ThemedText style={dynamicStyles.title} numberOfLines={1} ellipsizeMode="tail">
                        {detail.title}
                    </ThemedText>
                    <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
                        <Heart
                            size={24}
                            color={isFavorited ? colors.tint : colors.icon}
                            fill={isFavorited ? colors.tint : 'transparent'}
                        />
                    </StyledButton>
                </View>
                <StyledButton
                    onPress={handlePrimaryPlay}
                    style={dynamicStyles.playButton}
                    text={playButtonLabel}
                    onFocus={onFocus}
                    textStyle={dynamicStyles.playButtonText}
                    disabled={isPlayDisabled}
                    hasTVPreferredFocus={true}
                    nextFocusDown={nextFocusDown}
                />
                <View style={dynamicStyles.metaContainer}>
                    <ThemedText style={dynamicStyles.metaText}>{detail.year}</ThemedText>
                    <ThemedText style={dynamicStyles.metaText}>{detail.type_name}</ThemedText>
                </View>

                <ScrollView
                    style={dynamicStyles.descriptionScrollView}
                    showsVerticalScrollIndicator={false}
                    nextFocusDown={nextFocusDown}
                >
                    <ThemedText style={dynamicStyles.description}>{detail.desc}</ThemedText>
                </ScrollView>
            </View>
        </View>
    );
});

TVTopInfo.displayName = 'TVTopInfo';
