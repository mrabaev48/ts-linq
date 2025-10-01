import type { GlobalFilter, SoftDeleteOptions, WhereClause } from '../types';
export declare class GlobalFilterApplier {
    apply(entityClass: Function, model: {
        where?: WhereClause[];
    }, softDeleteOptions: SoftDeleteOptions | undefined, globalFilters?: GlobalFilter[]): void;
}
//# sourceMappingURL=GlobalFilterApplier.d.ts.map