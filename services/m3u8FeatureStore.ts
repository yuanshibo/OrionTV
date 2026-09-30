import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '@/utils/Logger';

const logger = Logger.withTag('M3U8FeatureStore');

const STORAGE_KEY = '@oriontv_m3u8_learned_features';

export interface LearnedAdFeatures {
  keywords: string[];
  durations: number[];
}

let inMemoryFeatures: LearnedAdFeatures = {
  keywords: [],
  durations: [],
};
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Initializes and loads learned features from persistent storage.
 */
export async function initFeatureStore(): Promise<void> {
  if (isLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        inMemoryFeatures = {
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          durations: Array.isArray(parsed.durations) ? parsed.durations : [],
        };
        logger.info(
          `Loaded ${inMemoryFeatures.keywords.length} keywords, ${inMemoryFeatures.durations.length} durations from storage`
        );
      }
    } catch (e) {
      logger.warn('Failed to load learned ad features from storage:', e);
    } finally {
      isLoaded = true;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Gets all learned keywords as compiled RegExp array.
 */
export function getLearnedKeywords(): RegExp[] {
  return inMemoryFeatures.keywords.map((k) => {
    try {
      return new RegExp(k, 'i');
    } catch {
      return new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
  });
}

/**
 * Gets all learned ad durations.
 */
export function getLearnedDurations(): number[] {
  return inMemoryFeatures.durations;
}

const MAX_LEARNED_KEYWORDS = 50;
const MAX_LEARNED_DURATIONS = 50;

/**
 * Extracts a distinctive regex pattern string from an ad URL.
 *
 * IMPORTANT: Only returns a pattern when the URL contains unambiguous ad-specific
 * identifiers (e.g. ad/dsp/gg in hostname or path). Returns null for generic CDN
 * hostnames that are shared between ad and movie segments, to prevent mislearning
 * normal CDN domains as ad keywords which would cause false positives on movie content.
 */
export function extractUrlPattern(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    // Only match if hostname itself contains unambiguous ad-specific tokens
    if (/ad|guang|gg|dsp|union|pop|adv/i.test(host)) {
      return host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    // Check pathname for distinctive ad directory segments
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    for (const part of pathParts) {
      if (/^(ad|adv|guanggao|advert|dsp|union|pop|gg)$/i.test(part)) {
        return `\\/${part}\\/`;
      }
    }
    // Do NOT fall back to generic CDN hostname — shared CDN domains would cause
    // false positives on all movie segments from that CDN.
    return null;
  } catch {
    // For non-standard URLs, only match explicit ad tokens in the path
    const match = url.match(/(guanggao|\/ad\/|\/adv\/|\/gg\/|\/pop\/)/i);
    return match ? match[0] : null;
  }
}

/**
 * Records newly verified ad features (URL keyword or duration) and persists to storage.
 * Enforces capacity limits to prevent unbounded memory growth.
 */
export async function learnAdFeature(feature: { url?: string; duration?: number }): Promise<boolean> {
  await initFeatureStore();

  let modified = false;

  if (feature.url) {
    const pattern = extractUrlPattern(feature.url);
    if (pattern && !inMemoryFeatures.keywords.includes(pattern)) {
      inMemoryFeatures.keywords.push(pattern);
      // Evict oldest entry when capacity is exceeded
      if (inMemoryFeatures.keywords.length > MAX_LEARNED_KEYWORDS) {
        inMemoryFeatures.keywords.shift();
      }
      modified = true;
      logger.info(`[LearnedFeature] Learned new ad pattern: "${pattern}" from ${feature.url}`);
    }
  }

  if (feature.duration !== undefined && feature.duration > 0) {
    const roundedDur = Math.round(feature.duration * 10) / 10;
    const exists = inMemoryFeatures.durations.some((d) => Math.abs(d - roundedDur) <= 0.5);
    if (!exists) {
      inMemoryFeatures.durations.push(roundedDur);
      // Evict oldest entry when capacity is exceeded
      if (inMemoryFeatures.durations.length > MAX_LEARNED_DURATIONS) {
        inMemoryFeatures.durations.shift();
      }
      modified = true;
      logger.info(`[LearnedFeature] Learned new ad duration: ${roundedDur}s`);
    }
  }

  if (modified) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryFeatures));
    } catch (e) {
      logger.warn('Failed to persist learned ad features:', e);
    }
  }

  return modified;
}

/**
 * Resets the in-memory and persistent learned feature store.
 */
export async function clearLearnedFeatures(): Promise<void> {
  inMemoryFeatures = { keywords: [], durations: [] };
  isLoaded = false;
  loadPromise = null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    logger.warn('Failed to clear learned ad features from storage:', e);
  }
}
