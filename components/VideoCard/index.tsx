import React from 'react';
import { GestureResponderEvent, TouchableOpacity, View } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { ContentApi } from '@/services/api';

// Import platform specific components
import VideoCardMobile from './VideoCard.mobile';
import VideoCardTablet from './VideoCard.tablet';
import VideoCardTV from './VideoCard.tv';

// Extract common props
interface VideoCardBaseProps extends Omit<React.ComponentProps<typeof TouchableOpacity>, 'onLongPress'> {
  id: string;
  source: string;
  title: string;
  poster: string;
  year?: string;
  rate?: string;
  sourceName?: string;
  progress?: number;
  playTime?: number;
  episodeIndex?: number;
  totalEpisodes?: number;
  onFocus?: () => void;
  onRecordDeleted?: () => void;
  onFavoriteDeleted?: () => void;
  api: ContentApi;
  type?: 'record' | 'favorite';
}

// Platform specific onLongPress types
interface VideoCardTVProps extends VideoCardBaseProps {
  onLongPress?: () => void;
}

interface VideoCardMobileProps extends VideoCardBaseProps {
  onLongPress?: (event: GestureResponderEvent) => void;
}

export type VideoCardProps = VideoCardTVProps | VideoCardMobileProps;

/**
 * Responsive VideoCard Component
 * Automatically selects the appropriate implementation based on device type.
 */
const VideoCard = React.forwardRef<View, VideoCardProps>((props, ref) => {
  const { deviceType } = useResponsiveLayout();

  // Memoize the component selection to avoid unnecessary checks?
  // Not strictly necessary as switch is fast, but good practice if we wanted to avoid re-mounts if deviceType flickers (unlikely).

  switch (deviceType) {
    case 'mobile':
      return <VideoCardMobile {...(props as VideoCardMobileProps)} ref={ref} />;
    
    case 'tablet':
      // Assuming Tablet uses TV props structure (no event in long press?) or casting to satisfy TS
      // The original code casted to VideoCardTVProps.
      return <VideoCardTablet {...(props as any)} ref={ref} />;
    
    case 'tv':
    default:
      return <VideoCardTV {...(props as VideoCardTVProps)} ref={ref} />;
  }
});

VideoCard.displayName = 'VideoCard';

// We memoize the wrapper too, to prevent re-rendering if parent re-renders but props are same.
// However, since it consumes a hook (useResponsiveLayout), it might still re-render if context changes.
export default React.memo(VideoCard);
