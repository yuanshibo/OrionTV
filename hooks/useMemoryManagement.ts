import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Image } from 'expo-image';
import { contentCacheService } from '@/services/ContentCacheService';
import { cleanupM3U8Cache } from '@/services/m3u8AdFilter';
import usePlayerStore from '@/stores/playerStore';
import Logger from '@/utils/Logger';

const logger = Logger.withTag('MemoryManagement');

/**
 * Hook to manage system-wide resource releases during memory pressure or background transitions.
 * Helps prevent OOM crashes during long playback or high-load home screen usage.
 *
 * On background:
 *  - contentCacheService.clear()   → releases the in-memory content cache (category data)
 *  - Image.clearMemoryCache()      → releases expo-image's in-memory image cache
 *    (disk cache is intentionally preserved for fast reload on resume)
 *  - cleanupM3U8Cache(...)         → prunes old/expired adfree M3U8 files while protecting active video
 *
 * TV devices typically have 1–2 GB RAM. After heavy usage (search, category browsing,
 * multi-episode playback), accumulated poster thumbnails can reach 50–100 MB+.
 * Clearing on background is safe and makes the app a good citizen of the OS memory model.
 */
export const useMemoryManagement = () => {
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            // In a real TV environment, 'background' often happens when another heavy app takes focus.
            // We clear our memory caches to be a good citizen and reduce risk of being killed by the OS.
            if (nextAppState === 'background') {
                logger.info('App went to background. Purging in-memory caches to save resources.');
                // 1. Content cache (category / list data)
                contentCacheService.clear();
                // 2. expo-image memory cache (poster thumbnails).
                //    Only the memory layer is cleared; disk cache is kept for fast resume.
                Image.clearMemoryCache();
                // 3. Prune old/expired adfree M3U8 files while protecting the currently active episode
                const { episodes, currentEpisodeIndex } = usePlayerStore.getState();
                const activeEpisode = episodes[currentEpisodeIndex];
                cleanupM3U8Cache({ activeUrl: activeEpisode?.url }).catch((e) =>
                    logger.debug('Background M3U8 cache cleanup error:', e)
                );
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);
};
