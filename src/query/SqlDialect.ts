import { QueryOptions } from '../types';

export interface SqlDialect {
    buildSelect<T>(entityClass: new () => T, options: QueryOptions): { query: string; parameters: any[] };
}


