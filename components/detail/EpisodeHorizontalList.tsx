import React, { memo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, FlatList, findNodeHandle } from 'react-native';
import { EpisodeButton } from '@/components/detail/EpisodeList';

interface EpisodeHorizontalListProps {
    episodes: any[];
    itemWidth: number;
    handlePlay: (index: number) => void;
    handleEpisodeFocus: (index: number) => void;
    firstRangeTag: number | null;
    dynamicStyles: any;
    setTargetEpisodeTag: (tag: number | null) => void;
}

export interface EpisodeHorizontalListRef {
    scrollToIndex: (params: { index: number; animated?: boolean; viewOffset?: number; viewPosition?: number }) => void;
}

export const EpisodeHorizontalList = memo(forwardRef<EpisodeHorizontalListRef, EpisodeHorizontalListProps>(({
    episodes,
    itemWidth,
    handlePlay,
    handleEpisodeFocus,
    firstRangeTag,
    dynamicStyles,
    setTargetEpisodeTag,
}, ref) => {
    const episodeListRef = useRef<FlatList>(null);
    const episodeRefs = useRef<Map<number, any>>(new Map());
    const initialTargetSet = useRef(false);

    useImperativeHandle(ref, () => ({
        scrollToIndex: (params) => {
            episodeListRef.current?.scrollToIndex(params);
        }
    }));

    const renderEpisodeItem = useCallback(({ item, index }: { item: any, index: number }) => {
        return (
            <View style={{ padding: 4, width: itemWidth }}>
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
                    index={index}
                    onPlay={handlePlay}
                    style={[dynamicStyles.episodeButton, { minHeight: 50 }]}
                    textStyle={[dynamicStyles.episodeButtonText, { fontSize: 16 }]}
                    onFocus={() => handleEpisodeFocus(index)}
                    nextFocusDown={index < 10 ? (firstRangeTag || undefined) : undefined}
                />
            </View>
        );
    }, [handlePlay, dynamicStyles, handleEpisodeFocus, itemWidth, firstRangeTag, setTargetEpisodeTag]);

    return (
        <View style={{ height: 60, marginBottom: 0 }}>
            <FlatList
                ref={episodeListRef}
                data={episodes}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={renderEpisodeItem}
                keyExtractor={(item, index) => `episode-${index}`}
                contentContainerStyle={{ paddingHorizontal: 0 }}
                getItemLayout={(data, index) => (
                    { length: itemWidth, offset: itemWidth * index, index }
                )}
                removeClippedSubviews={true}
                windowSize={10}
                initialNumToRender={10}
                ListFooterComponent={<View style={{ width: itemWidth * 9 }} />}
            />
        </View>
    );
}));

EpisodeHorizontalList.displayName = 'EpisodeHorizontalList';
