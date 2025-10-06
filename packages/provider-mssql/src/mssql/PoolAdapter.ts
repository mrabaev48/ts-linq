import type { SqlParameter } from '@ts-linq/core';

export interface MssqlPoolLike {
  connect(): Promise<void>;
  close(): Promise<void>;
  request(): MssqlRequestLike;
}

export interface MssqlRequestLike {
  input(name: string, value: SqlParameter): MssqlRequestLike;
  query<T = unknown>(sql: string): Promise<{ recordset?: T[]; rowsAffected?: number[] }>;
}

export function createMssqlPool(connectionString: string): MssqlPoolLike {
  const mssql = safeRequireMssql();
  return new mssql.ConnectionPool(connectionString) as MssqlPoolLike;
}

function safeRequireMssql(): {
  ConnectionPool: new (cs: string) => unknown;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mssql');
  } catch {
    throw new Error('Package "mssql" is required. Install it with: npm install mssql');
  }
}
