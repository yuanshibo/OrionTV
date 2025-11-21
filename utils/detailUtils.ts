import { SearchResult, SearchResultWithResolution } from "@/services/api";

export const normalizeIdentifier = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\u3000\u00A0\s]+/g, "")
    .replace(/[·•~!@#$%^&*()_+=[\]{}|\\;:'",.<>/?`！￥…（）—【】「」『』、《》？。，、丨-]/g, "");
};

export const VARIANT_SUFFIX_PATTERNS: readonly RegExp[] = [
  /(?:第?\d{1,3}(?:线|源))$/u, // “第1线”“1源”等线路编号
  /(?:线路?\d{1,3})$/u, // “线路1”“线1” 等简写
  /(?:line\d{1,3})$/u, // “line1” 等英文线路标签
  /(?:主线|多线|备用)$/u, // “主线”“备用”等调度说明
  /(?:无广|无广告)$/u, // “无广”一类去广告说明
  /(?:超清|高清|蓝光|标清|普清)$/u, // 画质标签
  /(?:\d{3,4}p)$/u, // 1080p 等数字画质标签
  /(?:4k|2k|uhd|fhd)$/u, // UHD/FHD 等英文画质标签
  /(?:资源|源|source)\d{1,3}$/u, // “资源1”“source2”等编号
];

/**
 * Remove marketing/line suffixes that aggregators append to provider names so that
 * "暴风资源线路1"、"暴风资源蓝光" 等变体都会映射到同一个去重键。
 */
export const stripVariantSuffixes = (value: string): string => {
  let result = value;
  let previous: string;

  do {
    previous = result;
    for (const pattern of VARIANT_SUFFIX_PATTERNS) {
      result = result.replace(pattern, "");
    }
  } while (previous !== result);

  return result;
};

export const normalizeSourceName = (sourceName?: string | null): string => {
  if (!sourceName) {
    return "";
  }

  const normalized = normalizeIdentifier(sourceName);
  return stripVariantSuffixes(normalized);
};

export const buildDetailCacheKey = (query: string, preferredSource?: string, resourceId?: string) => {
  const normalizedQuery = normalizeIdentifier(query);
  const normalizedSource = preferredSource ? normalizeIdentifier(preferredSource) : "";
  const normalizedId = resourceId ? resourceId.toString() : "";
  return `${normalizedQuery}::${normalizedSource}::${normalizedId}`;
};

export const buildResultDedupeKey = (
  item: Pick<SearchResult, "source" | "source_name" | "title" | "id">,
  contextSourceKey?: string
): string => {
  const contextKey = contextSourceKey ? stripVariantSuffixes(normalizeIdentifier(contextSourceKey)) : undefined;
  const sourceKey = stripVariantSuffixes(normalizeIdentifier(item.source));
  const nameKey = normalizeSourceName(item.source_name);

  if (contextKey) {
    return contextKey;
  }

  if (sourceKey) {
    return sourceKey;
  }

  if (nameKey) {
    return nameKey;
  }

  const titleKey = normalizeIdentifier(item.title);
  return titleKey ? `${titleKey}:${item.id}` : `${item.id}`;
};

export const labelPriority = (sourceName?: string | null): number => {
  if (!sourceName) {
    return 0;
  }

  const normalized = sourceName.trim().toLowerCase();
  let score = 0;

  if (normalized.includes("无广") || normalized.includes("无广告")) {
    score += 4;
  }
  if (normalized.includes("蓝光")) {
    score += 3;
  }
  if (normalized.includes("超清")) {
    score += 2;
  }
  if (normalized.includes("高清")) {
    score += 1;
  }
  if (normalized.includes("备用")) {
    score -= 3;
  }
  if (normalized.includes("线路") || normalized.includes("line")) {
    score -= 2;
  }
  if (normalized.includes("主线")) {
    score -= 1;
  }

  return score;
};

export const resolutionPriority = (resolution?: string | null): number => {
  if (!resolution) {
    return 0;
  }

  const normalized = resolution.toLowerCase();

  if (/(4k|2160)/.test(normalized)) {
    return 6;
  }
  if (/(2k|1440)/.test(normalized)) {
    return 5;
  }

  const match = normalized.match(/(\d{3,4})p/);
  if (match) {
    const value = Number(match[1]);
    if (value >= 2160) {
      return 6;
    }
    if (value >= 1440) {
      return 5;
    }
    if (value >= 1080) {
      return 4;
    }
    if (value >= 720) {
      return 3;
    }
    if (value >= 540) {
      return 2;
    }
    if (value >= 480) {
      return 1;
    }
  }

  if (normalized.includes("蓝光")) {
    return 4;
  }
  if (normalized.includes("超清")) {
    return 3;
  }
  if (normalized.includes("高清")) {
    return 2;
  }
  if (normalized.includes("标清")) {
    return 1;
  }

  return 0;
};

export const shouldPreferRawResult = (current: SearchResult, candidate: SearchResult): boolean => {
  const currentEpisodes = current.episodes?.length ?? 0;
  const candidateEpisodes = candidate.episodes?.length ?? 0;

  if (candidateEpisodes > currentEpisodes) {
    return true;
  }

  if (candidateEpisodes < currentEpisodes) {
    return false;
  }

  const currentLabelScore = labelPriority(current.source_name);
  const candidateLabelScore = labelPriority(candidate.source_name);

  if (candidateLabelScore > currentLabelScore) {
    return true;
  }

  if (candidateLabelScore < currentLabelScore) {
    return false;
  }

  const currentNameLength = current.source_name?.trim().length ?? 0;
  const candidateNameLength = candidate.source_name?.trim().length ?? 0;

  if (candidateNameLength && (!currentNameLength || candidateNameLength < currentNameLength)) {
    return true;
  }

  return false;
};

export const shouldPreferEnrichedResult = (
  current: SearchResultWithResolution,
  candidate: SearchResultWithResolution
): boolean => {
  const currentEpisodes = current.episodes?.length ?? 0;
  const candidateEpisodes = candidate.episodes?.length ?? 0;

  if (candidateEpisodes > currentEpisodes) {
    return true;
  }

  if (candidateEpisodes < currentEpisodes) {
    return false;
  }

  const currentResolutionScore = resolutionPriority(current.resolution);
  const candidateResolutionScore = resolutionPriority(candidate.resolution);

  if (candidateResolutionScore > currentResolutionScore) {
    return true;
  }

  if (candidateResolutionScore < currentResolutionScore) {
    return false;
  }

  const currentLabelScore = labelPriority(current.source_name);
  const candidateLabelScore = labelPriority(candidate.source_name);

  if (candidateLabelScore > currentLabelScore) {
    return true;
  }

  if (candidateLabelScore < currentLabelScore) {
    return false;
  }

  return false;
};

export const mergeResultsByDedupeKey = (
  items: SearchResultWithResolution[]
): SearchResultWithResolution[] => {
  const merged = new Map<string, SearchResultWithResolution>();

  for (const item of items) {
    const key = item.dedupeKey || buildResultDedupeKey(item);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, item);
      continue;
    }

    if (shouldPreferEnrichedResult(existing, item)) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values());
};
