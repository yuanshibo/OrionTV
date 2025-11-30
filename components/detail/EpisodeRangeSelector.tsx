import React, { memo, useMemo } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { StyledButton } from '@/components/StyledButton';
// import { Colors } from '@/constants/Colors';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface EpisodeRangeSelectorProps {
    totalEpisodes: number;
    currentRange: number;
    onRangeSelect: (index: number) => void;
    chunkSize?: number;
    styles?: any;
    colors?: any;
    focusOffset?: number;
    setFirstRangeRef?: (node: any) => void;
    nextFocusUp?: number | null;
}

export const EpisodeRangeSelector = memo(({
    totalEpisodes,
    currentRange,
    onRangeSelect,
    chunkSize = 50,
    styles: propStyles,
    colors: propColors,
    focusOffset = 0,
    setFirstRangeRef,
    nextFocusUp,
}: EpisodeRangeSelectorProps) => {
    const { deviceType } = useResponsiveLayout();
    const isMobile = deviceType === 'mobile';

    // Use passed colors or default to dark theme
    // const colors = propColors || Colors.dark;

    const ranges = useMemo(() => {
        if (totalEpisodes <= chunkSize) return [];

        const numChunks = Math.ceil(totalEpisodes / chunkSize);
        return Array.from({ length: numChunks }, (_, i) => {
            const start = i * chunkSize + 1;
            const end = Math.min((i + 1) * chunkSize, totalEpisodes);
            return {
                label: `${start}-${end}`,
                index: i,
            };
        });
    }, [totalEpisodes, chunkSize]);

    const flatListRef = React.useRef<FlatList>(null);

    const { width } = useWindowDimensions();

    const handleFocus = React.useCallback((index: number) => {
        if (!isMobile) {
            onRangeSelect(index);
            // Use requestAnimationFrame for smoother and faster interaction with native focus
            requestAnimationFrame(() => {
                // Align to second item by scrolling to index with offset
                flatListRef.current?.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0,
                    viewOffset: index === 0 ? 0 : focusOffset
                });
            });
        }
    }, [isMobile, onRangeSelect, focusOffset]);

    // Scroll to current range when it changes externally (e.g. from episode list focus)
    React.useEffect(() => {
        if (ranges.length > 0 && currentRange >= 0 && currentRange < ranges.length) {
            requestAnimationFrame(() => {
                // Align to second item by scrolling to currentRange with offset
                flatListRef.current?.scrollToIndex({
                    index: currentRange,
                    animated: true,
                    viewPosition: 0,
                    viewOffset: currentRange === 0 ? 0 : focusOffset
                });
            });
        }
    }, [currentRange, ranges.length, focusOffset]);

    const renderItem = React.useCallback(({ item }: { item: { label: string; index: number } }) => (
        <StyledButton
            ref={item.index === 0 ? setFirstRangeRef : undefined}
            text={item.label}
            onPress={() => onRangeSelect(item.index)}
            onFocus={() => handleFocus(item.index)}
            isSelected={currentRange === item.index}
            variant="ghost"
            style={styles.containerButton}
            buttonStyle={[
                styles.button,
                isMobile ? styles.mobileButton : styles.tvButton,
            ]}
            focusedStyle={{
                borderBottomWidth: 2,
                borderBottomColor: '#fff',
                backgroundColor: 'transparent',
                borderRadius: 0,
            }}
            textStyle={[
                styles.buttonText,
                currentRange === item.index && styles.selectedButtonText
            ]}
            nextFocusUp={item.index === 0 ? (nextFocusUp || undefined) : undefined}
        />
    ), [currentRange, isMobile, onRangeSelect, handleFocus, setFirstRangeRef, nextFocusUp]);

    if (ranges.length === 0) return null;

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={ranges}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                removeClippedSubviews={false} // Ensure off-screen items are focusable
                windowSize={21} // Keep more items rendered
                initialNumToRender={15}
                maxToRenderPerBatch={5}
                updateCellsBatchingPeriod={50}
                keyExtractor={(item) => item.index.toString()}
                renderItem={renderItem}
                ListFooterComponent={<View style={{ width: width }} />}
                onScrollToIndexFailed={(info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                        flatListRef.current?.scrollToIndex({
                            index: info.index,
                            animated: true,
                            viewPosition: 0,
                            viewOffset: info.index === 0 ? 0 : focusOffset
                        });
                    });
                }}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        marginBottom: 0,
    },
    scrollContent: {
        paddingHorizontal: 4,
    },
    containerButton: {
        marginBottom: 0,
        marginRight: 12,
    },
    button: {
        borderRadius: 0,
        borderWidth: 0,
        paddingHorizontal: 6,
        paddingVertical: 6,
        backgroundColor: 'transparent',
    },
    mobileButton: {
        minHeight: 42,
    },
    tvButton: {
        minHeight: 42,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
    },
    selectedButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
});

EpisodeRangeSelector.displayName = 'EpisodeRangeSelector';
