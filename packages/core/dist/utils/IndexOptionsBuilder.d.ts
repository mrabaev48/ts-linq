import type { IndexMetadata } from '@ts-linq/types';
export declare class IndexOptionsBuilder {
    private current;
    constructor(name: string);
    onColumns(columns: string[]): this;
    unique(isUnique?: boolean): this;
    where(predicate: string): this;
    orderBy(orders: {
        [column: string]: 'ASC' | 'DESC';
    }): this;
    expressions(exprs: string[]): this;
    collations(coll: {
        [column: string]: string;
    }): this;
    nulls(opts: {
        [column: string]: 'FIRST' | 'LAST';
    }): this;
    using(method: 'btree' | 'hash' | 'gin' | 'gist'): this;
    concurrently(flag?: boolean): this;
    withParams(params: Record<string, string | number | boolean>): this;
    mysqlVisibility(mode: 'VISIBLE' | 'INVISIBLE'): this;
    include(columns: string[]): this;
    build(): IndexMetadata;
}
//# sourceMappingURL=IndexOptionsBuilder.d.ts.map