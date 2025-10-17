export declare function safeCache(logger: unknown, payload: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    hit: boolean;
    provider?: string;
    ttl?: boolean;
}): void;
export declare function safeCacheSize(logger: unknown, payload: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    size: number;
    provider?: string;
}): void;
export declare function safeCacheEvicted(logger: unknown, payload: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    provider?: string;
}): void;
export declare function warnIfLoggerDebug(method: string, error: unknown): void;
//# sourceMappingURL=MetricsSafe.d.ts.map