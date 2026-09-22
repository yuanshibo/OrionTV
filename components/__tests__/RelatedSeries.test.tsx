import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RelatedSeries from '../RelatedSeries';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    searchVideos: jest.fn(),
  },
}));

jest.mock('@/components/VideoCard', () => {
  return function MockVideoCard(props: any) {
    const { Text: RNText } = jest.requireActual('react-native');
    return <RNText testID={`video-card-${props.title}`}>{props.title}</RNText>;
  };
});

describe('RelatedSeries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches using extracted root title, excludes current video, deduplicates, and shows sequels', async () => {
    (api.searchVideos as jest.Mock).mockResolvedValue({
      results: [
        { id: 1, title: '间谍过家家第一季', source: 'dyttzy' },
        { id: 2, title: '间谍过家家第一季', source: 'zuid' },
        { id: 3, title: '间谍过家家 第二季', source: 'dyttzy' },
        { id: 4, title: '间谍过家家 第二季', source: 'ffzy' },
        { id: 5, title: '间谍过家家 第三季', source: 'zy360' },
        { id: 6, title: '间谍过家家 代号：白', source: 'dyttzy' },
        { id: 7, title: '无关电影', source: 'dyttzy' },
      ],
    });

    const { queryByTestId, findByTestId, getByText } = render(
      <RelatedSeries title="间谍过家家第一季" />
    );

    // Should search using root term "间谍过家家", NOT "间谍过家家第一季"
    await waitFor(() => {
      expect(api.searchVideos).toHaveBeenCalledWith('间谍过家家');
    });

    // Should display related section title
    expect(getByText('相关推荐')).toBeTruthy();

    // Current item should be excluded
    expect(queryByTestId('video-card-间谍过家家第一季')).toBeNull();

    // Sequels should be present and deduplicated
    expect(await findByTestId('video-card-间谍过家家 第二季')).toBeTruthy();
    expect(await findByTestId('video-card-间谍过家家 第三季')).toBeTruthy();
    expect(await findByTestId('video-card-间谍过家家 代号：白')).toBeTruthy();
  });

  it('renders nothing when no results are found', async () => {
    (api.searchVideos as jest.Mock).mockResolvedValue({ results: [] });

    const { queryByText } = render(<RelatedSeries title="独一无二的冷门剧" />);

    await waitFor(() => {
      expect(api.searchVideos).toHaveBeenCalled();
    });

    expect(queryByText('相关推荐')).toBeNull();
  });
});
