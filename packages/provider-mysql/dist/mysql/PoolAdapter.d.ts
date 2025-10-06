import type { SqlParameter } from '@ts-linq/core';
export interface MySqlPoolLike {
  query(sql: string, params?: readonly SqlParameter[]): Promise<[unknown]>;
  execute(sql: string, params?: readonly SqlParameter[]): Promise<[unknown]>;
  end(): Promise<void>;
}
export declare function createMySqlPool(connectionString: string): MySqlPoolLike;
//# sourceMappingURL=PoolAdapter.d.ts.map
