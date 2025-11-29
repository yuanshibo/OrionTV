import React from 'react';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

// 导入不同平台的VideoCard组件
import VideoCardMobile from './VideoCard.mobile';
import VideoCardTablet from './VideoCard.tablet';
import VideoCardTV from './VideoCard.tv';

import { VideoCardProps, VideoCardMobileProps, VideoCardTVProps } from './VideoCard.types';


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
