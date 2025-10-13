import type { DatabaseProvider } from '@ts-linq/core/dist/DatabaseProvider';
import type { ChangeTracker } from '@ts-linq/core/dist/change-tracking/ChangeTracker';
import type { EntityLoader } from '@ts-linq/core/dist/loading/EntityLoader';
import type { LoadingOptions } from '@ts-linq/core/dist/loading/LoadingStrategy';
import type { PrimaryKeyOf } from '@ts-linq/core/dist/types';
import { TypedQueryable } from '@ts-linq/core/dist/query/TypedQueryable';
import type { EntityCacheLike } from '@ts-linq/core/dist/utils/EntityCache';
import type { PerformanceOptions, GlobalFilter } from '@ts-linq/core/dist/types';
export declare class DbSet<T extends object> {
    _entityClass: new () => T;
    private _provider;
    private _changeTracker;
    private _entityLoader;
    private _entityCache;
    private _performance;
    private _globalFilters;
    constructor(entityClass: new () => T, provider: DatabaseProvider, changeTracker: ChangeTracker, entityLoader?: EntityLoader, entityCache?: EntityCacheLike, performance?: PerformanceOptions, globalFilters?: GlobalFilter[]);
    add(entity: T): T;
    update(entity: T): T;
    remove(entity: T): T;
    addRange(entities: T[]): T[];
    updateRange(entities: T[]): T[];
    removeRange(entities: T[]): T[];
    find(id: PrimaryKeyOf<T>, options?: LoadingOptions): Promise<T | null>;
    toArray(options?: LoadingOptions): Promise<T[]>;
    findByIds(ids: ReadonlyArray<PrimaryKeyOf<T>>): Promise<T[]>;
    query(): TypedQueryable<T>;
    private applyLoading;
    private applyLoadingMany;
}
//# sourceMappingURL=DbSet.d.ts.map