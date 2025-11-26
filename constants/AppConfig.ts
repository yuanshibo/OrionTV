export const APP_CONFIG = {
    DETAIL: {
        MAX_PLAY_SOURCES: 8,
        MAX_CONCURRENT_SOURCE_REQUESTS: 3,
        CACHE_TTL: 10 * 60 * 1000, // 10 minutes
        CACHE_MAX_ENTRIES: 8,
        RESOLUTION_CACHE_TTL: 60 * 60 * 1000, // 1 hour
    },
    MESSAGES: {
        NETWORK_ERROR_FRIENDLY: "网络请求失败，请检查网络连接后重试",
    },
    REGEX: {
        VARIANT_SUFFIX_PATTERNS: [
            /(?:第?\d{1,3}(?:线|源))$/, // “第1线”“1源”等线路编号
            /(?:线路?\d{1,3})$/, // “线路1”“线1” 等简写
            /(?:line\d{1,3})$/, // “line1” 等英文线路标签
            /(?:主线|多线|备用)$/, // “主线”“备用”等调度说明
            /(?:无广|无广告)$/, // “无广”一类去广告说明
            /(?:超清|高清|蓝光|标清|普清)$/, // 画质标签
            /(?:\d{3,4}p)$/, // 1080p 等数字画质标签
            /(?:4k|2k|uhd|fhd)$/, // UHD/FHD 等英文画质标签
            /(?:资源|源|source)\d{1,3}$/, // “资源1”“source2”等编号
        ],
    }
} as const;
