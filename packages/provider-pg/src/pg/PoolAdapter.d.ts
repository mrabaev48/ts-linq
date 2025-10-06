import type { SqlParameter } from '@ts-linq/core';
export interface PgQueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}
export interface PgPoolLike {
  query<T = unknown>(sql: string, params?: readonly SqlParameter[]): Promise<PgQueryResult<T>>;
  end(): Promise<void>;
}
export declare function createPgPool(connectionString: string): PgPoolLike;
//# sourceMappingURL=PoolAdapter.d.ts.map
