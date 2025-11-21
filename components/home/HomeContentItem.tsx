import React from 'react';
import { View } from 'react-native';
import VideoCard from '@/components/VideoCard';
import { RowItem } from '@/types/home';
import { ContentApi } from '@/services/api';

interface HomeContentItemProps {
  item: RowItem;
  index: number;
  api: ContentApi;
  onRecordDeleted: () => void;
  onLongPress?: () => void;
  firstItemRef: any;
}

const HomeContentItem = React.memo(({
  item,
  index,
  api,
  onRecordDeleted,
  onLongPress,
  firstItemRef
}: HomeContentItemProps) => {

  return (
    <VideoCard
      ref={index === 0 ? firstItemRef : undefined}
      id={item.id}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      rate={item.rate}
      progress={item.progress}
      playTime={item.play_time}
      episodeIndex={item.episodeIndex}
      sourceName={item.sourceName}
      totalEpisodes={item.totalEpisodes}
      api={api}
      onRecordDeleted={onRecordDeleted}
      onLongPress={onLongPress}
    />
  );
});

HomeContentItem.displayName = 'HomeContentItem';
export default HomeContentItem;
