import type { DatabaseProvider } from '@ts-linq/core';
import type { PerformanceOptions, EntityCacheLike } from '@ts-linq/types';
export declare class RowMaterializer<T> {
    private readonly entityClass;
    private readonly provider;
    private readonly entityCache?;
    private readonly performance?;
    constructor(entityClass: new () => T, provider: DatabaseProvider, entityCache?: EntityCacheLike | undefined, performance?: PerformanceOptions | undefined);
    mapRowToEntity(row: unknown): T;
    private shouldUseL2Cache;
    private tryGetFromCache;
    private materializeEntity;
    private rememberInCache;
    private notifyMaterialized;
    private convertValue;
}
//# sourceMappingURL=RowMaterializer.d.ts.map