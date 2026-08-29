import React, { memo, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { View, findNodeHandle, Platform } from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { EpisodeButton } from '@/components/detail/EpisodeList';
import { FlashListOptimizer } from '@/utils/FlashListOptimizer';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

import { getEpisodeProgressInfo } from '@/utils/episodeUtils';

interface EpisodeHorizontalListProps {
    episodes: any[];
    itemWidth: number;
    handlePlay: (index: number) => void;
    handleEpisodeFocus: (index: number) => void;
    firstRangeTag: number | null;
    firstSourceTag?: number | null;
    nextFocusUpTag?: number | null;
    dynamicStyles: any;
    setTargetEpisodeTag: (tag: number | null) => void;
    resumeRecord?: { title?: string; index?: number; play_time?: number; total_time?: number; duration?: number } | null;
    detailTitle?: string;
}

export interface EpisodeHorizontalListRef {
    scrollToIndex: (params: { index: number; animated?: boolean; viewOffset?: number; viewPosition?: number }) => void;
    updateTargetEpisode: (index: number) => void;
}

export const EpisodeHorizontalList = memo(forwardRef<EpisodeHorizontalListRef, EpisodeHorizontalListProps>(({
    episodes,
    itemWidth,
    handlePlay,
    handleEpisodeFocus,
    firstRangeTag,
    firstSourceTag,
    nextFocusUpTag,
    dynamicStyles,
    setTargetEpisodeTag,
    resumeRecord,
    detailTitle,
}, ref) => {
    const { deviceType } = useResponsiveLayout();
    const episodeListRef = useRef<React.ElementRef<typeof FlashList>>(null);
    const episodeRefs = useRef<Map<number, any>>(new Map());
    const initialTargetSet = useRef(false);

    useImperativeHandle(ref, () => ({
        scrollToIndex: (params) => {
            const { index, animated, viewOffset = 0 } = params;
            // Manually calculate offset to ensure consistent behavior with FlatList's viewOffset
            // This guarantees the "second button" focus alignment (context preservation)
            // We assume viewPosition is 0 (default) as used in DetailTVView
            const offset = (index * itemWidth) - viewOffset;
            episodeListRef.current?.scrollToOffset({
                offset: Math.max(0, offset),
                animated
            });
        },
        updateTargetEpisode: (index: number) => {
            const node = episodeRefs.current.get(index);
            if (node) {
                setTargetEpisodeTag(findNodeHandle(node));
            }
        }
    }));

    const itemContainerStyle = useMemo(() => ({ padding: 4, width: itemWidth }), [itemWidth]);
    const buttonStyleOverride = useMemo(() => ({ minHeight: 50 }), []);
    const textStyleOverride = useMemo(() => ({ fontSize: 16 }), []);

    const renderEpisodeItem = useCallback(({ item, index }: { item: any, index: number }) => {
        const originalIndex = typeof item?.originalIndex === 'number' ? item.originalIndex : index;
        const progressInfo = getEpisodeProgressInfo(originalIndex, resumeRecord || null, detailTitle);

        return (
            <View style={itemContainerStyle}>
                <EpisodeButton
                    ref={(node) => {
                        if (node) {
                            episodeRefs.current.set(index, node);
                            // If this is the first episode and no target is set, set it
                            if (index === 0 && !initialTargetSet.current) {
                                setTargetEpisodeTag(findNodeHandle(node));
                                initialTargetSet.current = true;
                            }
                        } else {
                            episodeRefs.current.delete(index);
                        }
                    }}
                    index={originalIndex}
                    displayLabel={item?.title || `${originalIndex + 1}集`}
                    isWatched={progressInfo.isWatched}
                    isCurrent={progressInfo.isCurrent}
                    progress={progressInfo.progress}
                    onPlay={handlePlay}
                    style={[dynamicStyles.episodeButton, buttonStyleOverride]}
                    textStyle={[dynamicStyles.episodeButtonText, textStyleOverride]}
                    onFocus={() => handleEpisodeFocus(index)}
                    nextFocusUp={(nextFocusUpTag !== undefined ? nextFocusUpTag : firstSourceTag) || undefined}
                    nextFocusDown={index < 10 ? (firstRangeTag || undefined) : undefined}
                />
            </View>
        );
    }, [handlePlay, dynamicStyles, handleEpisodeFocus, itemContainerStyle, buttonStyleOverride, textStyleOverride, firstRangeTag, firstSourceTag, nextFocusUpTag, setTargetEpisodeTag, resumeRecord, detailTitle]);

    const flashListConfig = useMemo(() => 
        FlashListOptimizer.getHorizontalListConfig(deviceType, itemWidth),
        [deviceType, itemWidth]
    );

    const FlashListAny = FlashList as any;

    return (
        <View style={{ height: 60, marginBottom: 0 }}>
            <FlashListAny
                ref={episodeListRef}
                data={episodes}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={renderEpisodeItem}
                keyExtractor={(item: any, index: number) => (item?.originalIndex !== undefined ? `ep-${item.originalIndex}` : index.toString())}
                contentContainerStyle={{ paddingHorizontal: 0 }}
                overrideItemLayout={(layout: { size?: number; span?: number }, item: any, index: number, maxColumns: number, extraData: any) => {
                    layout.size = itemWidth;
                    layout.span = 1;
                }}
                {...flashListConfig}
                removeClippedSubviews={Platform.OS === 'android'}
                ListFooterComponent={<View style={{ width: itemWidth * 9 }} />}
            />
        </View>
    );
}));

EpisodeHorizontalList.displayName = 'EpisodeHorizontalList';
