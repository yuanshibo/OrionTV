import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useHomeUIStore } from '@/stores/homeUIStore';
import { api } from '@/services/api';

export const DynamicBackground = React.memo(() => {
    const focusedPoster = useHomeUIStore((state) => state.focusedPoster);

    if (!focusedPoster) return null;

    return (
        <View style={StyleSheet.absoluteFill}>
            <Image
                source={{ uri: api.getImageProxyUrl(focusedPoster) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={500}
                blurRadius={Platform.OS === 'ios' ? 20 : 10}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
        </View>
    );
});

DynamicBackground.displayName = 'DynamicBackground';
