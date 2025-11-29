import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useHomeUIStore } from '@/stores/homeUIStore';
import { api } from '@/services/api';
import { LinearGradient } from 'expo-linear-gradient';

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
                blurRadius={Platform.OS === 'ios' ? 10 : 5} // Reduced blur for better visibility
                cachePolicy="memory-disk"
            />
            <LinearGradient
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
});

DynamicBackground.displayName = 'DynamicBackground';
