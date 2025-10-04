import type { SqlParameter } from '@ts-linq/core';
export interface MssqlPoolLike {
    connect(): Promise<void>;
    close(): Promise<void>;
    request(): MssqlRequestLike;
}
export interface MssqlRequestLike {
    input(name: string, value: SqlParameter): MssqlRequestLike;
    query<T = unknown>(sql: string): Promise<{
        recordset?: T[];
        rowsAffected?: number[];
    }>;
}
export declare function createMssqlPool(connectionString: string): MssqlPoolLike;
//# sourceMappingURL=PoolAdapter.d.ts.map