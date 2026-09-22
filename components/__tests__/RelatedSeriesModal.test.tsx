import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { RelatedSeriesModal } from '../RelatedSeriesModal';
import usePlayerStore from '@/stores/playerStore';
import useDetailStore from '@/stores/detailStore';

const mockPush = jest.fn();
const mockDispatch = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useNavigation: () => ({
    dispatch: mockDispatch,
  }),
}));

jest.mock('../RelatedSeries', () => {
  return function MockRelatedSeries({ title, onItemPress }: any) {
    const { Text, TouchableOpacity } = jest.requireActual('react-native');
    return (
      <TouchableOpacity
        testID="mock-related-item"
        onPress={() =>
          onItemPress?.({
            id: 202,
            title: '间谍过家家第二季',
            source: 'dyttzy',
            poster: 'poster.jpg',
            year: '2023',
            type: '动漫',
          })
        }
      >
        <Text testID="mock-related-title">{title}</Text>
      </TouchableOpacity>
    );
  };
});

describe('RelatedSeriesModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    act(() => {
      usePlayerStore.getState().reset();
      usePlayerStore.setState({ showRelatedVideos: false });
      useDetailStore.setState({
        detail: {
          id: 101,
          title: '间谍过家家第一季',
          source: 'zy360',
          episodes: [],
        } as any,
      });
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders nothing when showRelatedVideos is false', () => {
    const { queryByText } = render(<RelatedSeriesModal />);
    expect(queryByText('相关剧集')).toBeNull();
  });

  it('renders modal with title and RelatedSeries when showRelatedVideos is true', () => {
    act(() => {
      usePlayerStore.setState({ showRelatedVideos: true });
    });

    const { getByText } = render(<RelatedSeriesModal />);
    expect(getByText('相关剧集')).toBeTruthy();
    expect(getByText('间谍过家家第一季')).toBeTruthy();
  });

  it('flushes playback record and resets route on series selection after cooldown', () => {
    const savePlayRecordSpy = jest.spyOn(usePlayerStore.getState(), 'savePlayRecord');

    act(() => {
      usePlayerStore.setState({ showRelatedVideos: true });
    });

    const { getByTestId } = render(<RelatedSeriesModal />);

    // 1. Click before cooldown (250ms) expires should be ignored
    act(() => {
      fireEvent.press(getByTestId('mock-related-item'));
    });
    expect(savePlayRecordSpy).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();

    // 2. Advance time past 250ms cooldown
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // 3. Click after cooldown
    act(() => {
      fireEvent.press(getByTestId('mock-related-item'));
    });

    expect(savePlayRecordSpy).toHaveBeenCalledWith({}, { immediate: true });
    expect(usePlayerStore.getState().showRelatedVideos).toBe(false);
    expect(mockDispatch).toHaveBeenCalledTimes(1);

    // Verify reset dispatch removes old play/detail routes
    const dispatchArg = mockDispatch.mock.calls[0][0];
    expect(typeof dispatchArg).toBe('function');

    const mockState = {
      routes: [
        { name: 'index' },
        { name: 'play', params: { title: '间谍过家家第一季' } },
      ],
      index: 1,
    };
    const resetAction = dispatchArg(mockState);
    expect(resetAction.type).toBe('RESET');
    expect(resetAction.payload.routes).toEqual([
      { name: 'index' },
      {
        name: 'detail',
        params: {
          q: '间谍过家家第二季',
          title: '间谍过家家第二季',
          poster: 'poster.jpg',
          year: '2023',
          type: '动漫',
          source: 'dyttzy',
          id: '202',
        },
      },
    ]);
    expect(resetAction.payload.index).toBe(1);
  });
});
