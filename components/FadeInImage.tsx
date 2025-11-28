import React, { useState } from 'react';
import { Animated, ImageStyle, StyleProp, View, StyleSheet, ImageProps } from 'react-native';

interface FadeInImageProps extends ImageProps {
    style?: StyleProp<ImageStyle>;
    duration?: number;
}

export const FadeInImage: React.FC<FadeInImageProps> = ({ style, duration = 500, ...props }) => {
    const [opacity] = useState(new Animated.Value(0));

    const onLoad = () => {
        Animated.timing(opacity, {
            toValue: 1,
            duration,
            useNativeDriver: true,
        }).start();
    };

    return (
        <View style={[styles.container, style]}>
            <Animated.Image
                {...props}
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
