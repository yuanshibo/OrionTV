import { SearchResult, SearchResultWithResolution } from "@/services/api";
import { APP_CONFIG } from "@/constants/AppConfig";
import { buildResultDedupeKey, mergeResultsByDedupeKey } from "./DetailUtils";

export interface ProcessResult {
    results: SearchResultWithResolution[];
    added: string[];
    updated: string[];
    reachedMax: boolean;
}

export const processNewResults = (
    currentResults: SearchResultWithResolution[],
    newResults: SearchResult[],
    merge: boolean,
    sourceKey?: string
): ProcessResult => {
    // 1. Filter valid results
    let validResults = newResults.filter(
        (r) => r.episodes && r.episodes.length > 0
    );

    if (sourceKey) {
        validResults = validResults.filter((r) => r.source === sourceKey);
    }

    // 2. Map to SearchResultWithResolution
    let newCandidates: SearchResultWithResolution[] = validResults.map((r) => ({
        ...r,
        resolution: undefined, // Initially undefined
        source_name: r.source_name || r.source, // Fallback
    }));

    // 3. Handle replacements (same ID and source)
    // This logic was in the original store, we need to preserve it or simplify it.
    // The original logic separated "replacements" from "new candidates".
    // But mergeResultsByDedupeKey handles deduplication.

    // However, the original logic had a specific check for "replacements" to avoid increasing the count?
    // Let's rely on mergeResultsByDedupeKey for simplicity, but we need to respect the limit.

    const combined = merge
        ? [...currentResults, ...newCandidates]
        : [...newCandidates];

    const mergedResults = mergeResultsByDedupeKey(combined);

    // 4. Sort? The original didn't explicitly sort here, but mergeResultsByDedupeKey preserves order of insertion/update?
    // Actually mergeResultsByDedupeKey uses a Map, so insertion order is preserved.

    const truncated = mergedResults.slice(0, APP_CONFIG.DETAIL.MAX_PLAY_SOURCES);
    const reachedMax = truncated.length >= APP_CONFIG.DETAIL.MAX_PLAY_SOURCES;

    // 5. Calculate added/updated
    const previousMap = new Map(
        currentResults.map((item) => [item.dedupeKey || buildResultDedupeKey(item), item])
    );

    const added: string[] = [];
    const updated: string[] = [];

    for (const item of truncated) {
        const key = item.dedupeKey || buildResultDedupeKey(item);
        const prev = previousMap.get(key);
        if (!prev) {
            added.push(key);
        } else if (
            prev.episodes.length !== item.episodes.length ||
            prev.resolution !== item.resolution ||
            prev.source_name !== item.source_name
        ) {
            updated.push(key);
        }
    }

    return {
        results: truncated,
        added,
        updated,
        reachedMax,
    };
};
