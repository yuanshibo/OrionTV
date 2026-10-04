import React, { useRef } from 'react';
import { Animated, ImageStyle, StyleProp, View, StyleSheet, ImageProps } from 'react-native';

interface FadeInImageProps extends ImageProps {
    style?: StyleProp<ImageStyle>;
    duration?: number;
}

export const FadeInImage: React.FC<FadeInImageProps> = ({ style, duration = 500, source, ...props }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    const onLoad = () => {
        Animated.timing(opacity, {
            toValue: 1,
            duration,
            useNativeDriver: true,
        }).start();
    };

    const hasValidUri = !source || typeof source !== 'object' || !('uri' in source) || Boolean((source as any).uri);
    if (!hasValidUri) {
        return <View style={[styles.container, style]} />;
    }

    return (
        <View style={[styles.container, style]}>
            <Animated.Image
                {...props}
                source={source}
                onLoad={onLoad}
                style={[StyleSheet.absoluteFill, style, { opacity }]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: '#2a2a2a', // Placeholder color
    },
});
