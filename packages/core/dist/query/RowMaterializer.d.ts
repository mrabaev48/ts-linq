import type { DatabaseProvider } from '../DatabaseProvider';
import type { PerformanceOptions } from '../types';
import type { EntityCacheLike } from '../utils/EntityCache';
export declare class RowMaterializer<T> {
    private readonly entityClass;
    private readonly provider;
    private readonly entityCache?;
    private readonly performance?;
    constructor(entityClass: new () => T, provider: DatabaseProvider, entityCache?: EntityCacheLike, performance?: PerformanceOptions | undefined);
    mapRowToEntity(row: unknown): T;
    private shouldUseL2Cache;
    private tryGetFromCache;
    private materializeEntity;
    private rememberInCache;
    private notifyMaterialized;
    private convertValue;
}
//# sourceMappingURL=RowMaterializer.d.ts.map