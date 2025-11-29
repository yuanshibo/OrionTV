import { GestureResponderEvent, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { API } from '@/services/api';

export interface VideoCardBaseProps extends Omit<React.ComponentProps<typeof TouchableOpacity>, 'onLongPress'> {
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
    onFocus?: (item?: any) => void;
    onRecordDeleted?: () => void;
    onFavoriteDeleted?: () => void;
    api: API;
    type?: 'record' | 'favorite';
    style?: StyleProp<ViewStyle>;
}

export interface VideoCardTVProps extends VideoCardBaseProps {
    onLongPress?: () => void;
}

export interface VideoCardMobileProps extends VideoCardBaseProps {
    onLongPress?: (event: GestureResponderEvent) => void;
}

export type VideoCardProps = VideoCardTVProps | VideoCardMobileProps;
