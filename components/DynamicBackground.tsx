import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useHomeUIStore } from '@/stores/homeUIStore';
import { api } from '@/services/api';

interface DynamicBackgroundProps {
    poster?: string | null;
    useProxy?: boolean;
}

export const DynamicBackground = React.memo(({ poster, useProxy = true }: DynamicBackgroundProps) => {
    const storeFocusedPoster = useHomeUIStore((state) => state.focusedPoster);
    const backgroundPoster = poster !== undefined ? poster : storeFocusedPoster;

    if (!backgroundPoster) return null;

    const imageUrl = useProxy ? api.getImageProxyUrl(backgroundPoster) : backgroundPoster;

    return (
        <View style={StyleSheet.absoluteFill}>
            <Image
                key={imageUrl}
                source={{ uri: imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={500}
                blurRadius={Platform.OS === 'ios' ? 20 : 10}
                cachePolicy="memory-disk"
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
        </View>
    );
});

DynamicBackground.displayName = 'DynamicBackground';
