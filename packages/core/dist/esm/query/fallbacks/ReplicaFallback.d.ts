import type { QueryFallback, FallbackRequest, FreshnessConstraints } from '../../types';
import type { DatabaseProvider } from '../../DatabaseProvider';
/** Read-only replica fallback using another DatabaseProvider. */
export declare class ReplicaFallback<T> implements QueryFallback<T> {
    readonly label: string;
    private readonly replica;
    private readonly freshness?;
    private readonly serverCountPreferred;
    constructor(replica: DatabaseProvider, options?: {
        freshness?: FreshnessConstraints;
        serverCountPreferred?: boolean;
    });
    fetch(request: FallbackRequest<T>): Promise<ReadonlyArray<T> | null>;
    fetchCount(request: FallbackRequest<T>): Promise<number | null>;
}
//# sourceMappingURL=ReplicaFallback.d.ts.map