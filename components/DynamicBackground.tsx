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

export const PureDynamicBackground = React.memo(({ poster, useProxy = true }: DynamicBackgroundProps) => {
    if (!poster) return null;

    const imageUrl = useProxy ? api.getImageProxyUrl(poster) : poster;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image
                source={{ uri: imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={Platform.OS === 'android' ? 0 : 500}
                blurRadius={Platform.OS === 'ios' ? 10 : Platform.OS === 'android' ? 0 : 1} // Remove blur on Android to save GPU
                cachePolicy="disk"
                recyclingKey={imageUrl}
            />
            <LinearGradient
                colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,1)']}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
});

PureDynamicBackground.displayName = 'PureDynamicBackground';

export const DynamicBackground = React.memo(({ poster, useProxy = true }: DynamicBackgroundProps) => {
    const storeFocusedPoster = useHomeUIStore((state) => state.focusedPoster);
    const backgroundPoster = poster !== undefined ? poster : storeFocusedPoster;

    return <PureDynamicBackground poster={backgroundPoster} useProxy={useProxy} />;
});

DynamicBackground.displayName = 'DynamicBackground';
