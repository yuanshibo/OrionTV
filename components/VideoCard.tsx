import React from 'react';
import { GestureResponderEvent, TouchableOpacity } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { API } from '@/services/api';

// 导入不同平台的VideoCard组件
import VideoCardMobile from './VideoCard.mobile';
import VideoCardTablet from './VideoCard.tablet';
import VideoCardTV from './VideoCard.tv';

// 提取VideoCard的核心属性，除了onLongPress
// Omit<React.ComponentProps<typeof TouchableOpacity>, 'onLongPress'>
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
  api: API;
  type?: 'record' | 'favorite';
}

// 为不同的平台定义特定的onLongPress类型
interface VideoCardTVProps extends VideoCardBaseProps {
  onLongPress?: () => void;
}

interface VideoCardMobileProps extends VideoCardBaseProps {
  onLongPress?: (event: GestureResponderEvent) => void;
}

// VideoCardProps作为所有可能属性的联合
export type VideoCardProps = VideoCardTVProps | VideoCardMobileProps;


/**
 * 响应式VideoCard组件
 * 根据设备类型自动选择合适的VideoCard实现
 */
const VideoCard = React.forwardRef<any, VideoCardProps>((props, ref) => {
  const { deviceType } = useResponsiveLayout();

  switch (deviceType) {
    case 'mobile':
      // 对于Mobile，我们需要确保onLongPress是正确的类型
      return <VideoCardMobile {...(props as VideoCardMobileProps)} ref={ref} />;
    
    case 'tablet':
      // Tablet可能使用与Mobile或TV相同的实现，或其自身的实现
      // 这里我们假设它使用TV的实现，因此需要类型断言
      return <VideoCardTablet {...(props as VideoCardTVProps)} ref={ref} />;
    
    case 'tv':
    default:
      // TV平台需要一个不带参数的onLongPress
      return <VideoCardTV {...(props as VideoCardTVProps)} ref={ref} />;
  }
});

VideoCard.displayName = 'VideoCard';

export default React.memo(VideoCard);
