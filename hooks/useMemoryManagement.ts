import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Image } from 'expo-image';
import { contentCacheService } from '@/services/ContentCacheService';
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
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);
};
