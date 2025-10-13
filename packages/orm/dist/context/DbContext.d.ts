import type { DatabaseProvider } from '@ts-linq/core/dist/DatabaseProvider';
import { ChangeTracker } from '@ts-linq/core/dist/change-tracking/ChangeTracker';
import type { DbContextOptions, PerformanceOptions, Result, LoadingDefaults, SoftDeleteOptions, AuditOptions } from '@ts-linq/core/dist/types';
import { DbSet } from './DbSet';
export declare abstract class DbContext {
    private _provider;
    private _changeTracker;
    private _entityLoader;
    private _dbSets;
    private _defaultLoadingStrategy;
    private _entityCache?;
    private _performanceOptions?;
    private _loadingDefaults;
    private _softDelete?;
    private _audit?;
    private _globalFilters?;
    private _validationOptions?;
    private _validationService;
    private _insertCmd;
    private _updateCmd;
    private _deleteCmd;
    private _validationRulesCache;
    constructor(options: DbContextOptions);
    set<T extends object>(entityClass: new () => T): DbSet<T>;
    protected configure(options: {
        loading?: LoadingDefaults;
        performance?: PerformanceOptions;
        softDelete?: SoftDeleteOptions;
        audit?: AuditOptions;
        logger?: {
            warn(message: string, error?: unknown): void;
        };
    }): void;
    get provider(): DatabaseProvider;
    get changeTracker(): ChangeTracker;
    saveChanges(): Promise<Result<number>>;
    private handleSoftDelete;
    private updateEntityCache;
    private removeFromEntityCache;
    private getPrimaryKey;
    private initializeDbSets;
    private registerDbSet;
    private buildAutoPropertyName;
}
//# sourceMappingURL=DbContext.d.ts.map