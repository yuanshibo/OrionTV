import { create } from 'zustand';
import { api, SearchResult, PlayRecord } from '@/services/api';
import { PlayRecordManager } from '@/services/storage';

export type RowItem = (SearchResult | PlayRecord) & {
  id: string;
  source: string;
  title: string;
  poster: string;
  progress?: number;
  lastPlayed?: number;
  episodeIndex?: number;
  sourceName?: string;
  totalEpisodes?: number;
  year?: string;
  rate?: string;
};

export interface Category {
  title: string;
  type?: 'movie' | 'tv' | 'record';
  tag?: string;
}

const initialCategories: Category[] = [
  { title: '最近播放', type: 'record' },
  { title: '热门剧集', type: 'tv', tag: '热门' },
  { title: '综艺', type: 'tv', tag: '综艺' },
  { title: '热门电影', type: 'movie', tag: '热门' },
  { title: '豆瓣 Top250', type: 'movie', tag: 'top250' },
  { title: '儿童', type: 'movie', tag: '少儿' },
  { title: '美剧', type: 'tv', tag: '美剧' },
  { title: '韩剧', type: 'tv', tag: '韩剧' },
  { title: '日剧', type: 'tv', tag: '日剧' },
  { title: '日漫', type: 'tv', tag: '日本动画' },
];

interface HomeState {
  categories: Category[];
  selectedCategory: Category;
  contentData: RowItem[];
  loading: boolean;
  loadingMore: boolean;
  pageStart: number;
  hasMore: boolean;
  error: string | null;
  fetchInitialData: () => Promise<void>;
  loadMoreData: () => Promise<void>;
  selectCategory: (category: Category) => void;
  refreshPlayRecords: () => Promise<void>;
}

const useHomeStore = create<HomeState>((set, get) => ({
  categories: initialCategories,
  selectedCategory: initialCategories[0],
  contentData: [],
  loading: true,
  loadingMore: false,
  pageStart: 0,
  hasMore: true,
  error: null,

  fetchInitialData: async () => {
    const { selectedCategory } = get();
    set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null });
    await get().loadMoreData();
    set({ loading: false });
  },

  loadMoreData: async () => {
    const { selectedCategory, pageStart, loading, loadingMore, hasMore } = get();
    if (loading || loadingMore || !hasMore) return;

    if (selectedCategory.type === 'record') {
      const records = await PlayRecordManager.getAll();
      const rowItems = Object.entries(records)
        .map(([key, record]) => {
          const [source, id] = key.split('+');
          return { ...record, id, source, progress: record.play_time / record.total_time, poster: record.cover, sourceName: record.source_name, episodeIndex: record.index, totalEpisodes: record.total_episodes, lastPlayed: record.save_time };
        })
        .filter(record => record.progress !== undefined && record.progress > 0 && record.progress < 1)
        .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
      
      set({ contentData: rowItems, hasMore: false });
      return;
    }

    if (!selectedCategory.type || !selectedCategory.tag) return;

    set({ loadingMore: true });
    try {
      const result = await api.getDoubanData(selectedCategory.type, selectedCategory.tag, 20, pageStart);
      if (result.list.length === 0) {
        set({ hasMore: false });
      } else {
        const newItems = result.list.map(item => ({
          ...item,
          id: item.title,
          source: 'douban',
        })) as RowItem[];
        set(state => ({
          contentData: pageStart === 0 ? newItems : [...state.contentData, ...newItems],
          pageStart: state.pageStart + result.list.length,
          hasMore: true,
        }));
      }
    } catch (err: any) {
      if (err.message === 'API_URL_NOT_SET') {
        set({ error: '请点击右上角设置按钮，配置您的 API 地址' });
      } else {
        set({ error: '加载失败，请重试' });
      }
    } finally {
      set({ loadingMore: false });
    }
  },

  selectCategory: (category: Category) => {
    set({ selectedCategory: category });
    get().fetchInitialData();
  },

  refreshPlayRecords: async () => {
    const records = await PlayRecordManager.getAll();
    const hasRecords = Object.keys(records).length > 0;
    set(state => {
      const recordCategoryExists = state.categories.some(c => c.type === 'record');
      if (hasRecords && !recordCategoryExists) {
        return { categories: [initialCategories[0], ...state.categories] };
      }
      if (!hasRecords && recordCategoryExists) {
        const newCategories = state.categories.filter(c => c.type !== 'record');
        if (state.selectedCategory.type === 'record') {
            get().selectCategory(newCategories[0] || null);
        }
        return { categories: newCategories };
      }
      return {};
    });
    if (get().selectedCategory.type === 'record') {
      get().fetchInitialData();
    }
  },
}));

export default useHomeStore;