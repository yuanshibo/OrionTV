import React, { useEffect, useRef } from 'react';
import { View, Animated, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { createResponsiveStyles } from './detail.styles';

const SkeletonItem = ({ style }: { style: StyleProp<ViewStyle> }) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return (
        <Animated.View style={[style, { opacity, backgroundColor: Colors.dark.border }]} />
    );
};

export const DetailTVSkeleton = () => {
    const { deviceType, spacing } = useResponsiveLayout();
    const colors = Colors.dark;
    const styles = createResponsiveStyles(deviceType, spacing, colors);
    const { width } = useWindowDimensions();

    // Calculate item width for episodes/sources
    const padding = 40;
    const itemWidth = (width - padding) / 10;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Top Container */}
            <View style={styles.topContainer}>
                {/* Poster Skeleton */}
                <SkeletonItem style={[styles.poster, { backgroundColor: colors.border }]} />

                <View style={styles.infoContainer}>
                    {/* Title Skeleton */}
                    <View style={styles.titleContainer}>
                        <SkeletonItem style={{ width: 400, height: 40, borderRadius: 8 }} />
                    </View>

                    {/* Play Button Skeleton */}
                    <SkeletonItem style={[styles.playButton, { width: 140, height: 45, borderRadius: 8, marginTop: 20 }]} />

                    {/* Meta Skeleton */}
                    <View style={[styles.metaContainer, { marginTop: 20 }]}>
                        <SkeletonItem style={{ width: 60, height: 20, marginRight: 20, borderRadius: 4 }} />
                        <SkeletonItem style={{ width: 80, height: 20, borderRadius: 4 }} />
                    </View>

                    {/* Description Skeleton */}
                    <View style={{ marginTop: 20 }}>
                        <SkeletonItem style={{ width: '80%', height: 16, marginBottom: 10, borderRadius: 4 }} />
                        <SkeletonItem style={{ width: '90%', height: 16, marginBottom: 10, borderRadius: 4 }} />
                        <SkeletonItem style={{ width: '70%', height: 16, borderRadius: 4 }} />
                    </View>
                </View>
            </View>

            {/* Bottom Container */}
            <View style={styles.bottomContainer}>
                {/* Source List Skeleton */}
                <View style={styles.sourcesContainer}>
                    <SkeletonItem style={{ width: 100, height: 24, marginBottom: 10, borderRadius: 4 }} />
                    <View style={{ flexDirection: 'row' }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonItem key={i} style={{ width: 100, height: 40, marginRight: 10, borderRadius: 8 }} />
                        ))}
                    </View>
                </View>

                {/* Episode List Skeleton */}
                <View style={styles.episodesContainer}>
                    <SkeletonItem style={{ width: 100, height: 24, marginBottom: 10, borderRadius: 4 }} />
                    <View style={{ flexDirection: 'row' }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <SkeletonItem key={i} style={{ width: itemWidth - 10, height: 50, marginRight: 10, borderRadius: 8 }} />
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
};
