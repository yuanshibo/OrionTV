import { render } from '@testing-library/react-native';
import React from 'react';
import VideoCard from '../VideoCard';

// Mock the child components to avoid testing implementation details
jest.mock('../VideoCard.tv', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    const MockVideoCardTV = (props: any) => <View testID="video-card-tv" {...props} />;
    MockVideoCardTV.displayName = 'VideoCardTV';
    return MockVideoCardTV;
});
jest.mock('../ResponsiveVideoCard', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    const MockResponsiveVideoCard = (props: any) => <View testID="video-card-mobile" {...props} />;
    MockResponsiveVideoCard.displayName = 'ResponsiveVideoCard';
    return MockResponsiveVideoCard;
});

jest.mock('@/hooks/useResponsiveLayout', () => ({
    useResponsiveLayout: () => ({
        deviceType: 'mobile',
        cardWidth: 100,
        cardHeight: 150,
        spacing: 10,
    }),
}));

jest.mock('@/hooks/useVideoCardInteractions', () => ({
    useVideoCardInteractions: () => ({
        handlePress: jest.fn(),
        handleLongPress: jest.fn(),
    }),
}));

jest.mock('@/stores/authStore', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        authCookie: 'test-cookie',
    })),
}));

jest.mock('@/services/api', () => ({
    api: {
        getImageProxyUrl: (url: string) => url,
    },
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});

describe('VideoCard', () => {
    const mockApi = {
        getImageProxyUrl: (url: string) => url,
    };

    const mockProps = {
        id: '1',
        source: 'test-source',
        title: 'Test Video',
        poster: 'http://example.com/poster.jpg',
        api: mockApi as any,
    };

    it('renders correctly on mobile', () => {
        const { getByText } = render(<VideoCard {...mockProps} />);
        expect(getByText('Test Video')).toBeTruthy();
    });

    it('renders rating when provided', () => {
        const { getByText } = render(<VideoCard {...mockProps} rate="9.0" />);
        expect(getByText('9.0')).toBeTruthy();
    });

    it('renders year when provided', () => {
        const { getByText } = render(<VideoCard {...mockProps} year="2023" />);
        expect(getByText('2023')).toBeTruthy();
    });

    it('renders progress bar when progress is provided', () => {
        const { getByText } = render(<VideoCard {...mockProps} progress={0.5} episodeIndex={1} />);
        // Check for continue watching text
        expect(getByText(/第2集/)).toBeTruthy();
    });
});
