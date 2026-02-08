import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { contentCacheService } from '@/services/ContentCacheService';
import Logger from '@/utils/Logger';

const logger = Logger.withTag('MemoryManagement');

/**
 * Hook to manage system-wide resource releases during memory pressure or background transitions.
 * Helps prevent OOM crashes during long playback or high-load home screen usage.
 */
export const useMemoryManagement = () => {
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            // In a real TV environment, 'background' often happens when another heavy app takes focus.
            // We clear our memory cache to be a good citizen and reduce risk of being killed by the OS.
            if (nextAppState === 'background') {
                logger.info('App went to background. Purging in-memory cache to save resources.');
                contentCacheService.clear();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Note: React Native doesn't have a direct "memoryPressure" listener in core the same way Browser does,
        // but some platform constants or native modules can provide it. 
        // For now, we rely on AppState backgrounding as the primary trigger for mass cleanup.

        return () => {
            subscription.remove();
        };
    }, []);
};
