import type { SqlParameter } from '@ts-linq/core';

export interface PgQueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

export interface PgPoolLike {
  query<T = unknown>(sql: string, params?: readonly SqlParameter[]): Promise<PgQueryResult<T>>;
  end(): Promise<void>;
}

type PgModule = { Pool: new (cfg: { connectionString: string }) => PgPoolLike };

let Pg: PgModule | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Pg = require('pg');
} catch {
  Pg = undefined;
}

export function createPgPool(connectionString: string): PgPoolLike {
  if (!Pg) throw new Error('pg module is not installed');
  const { Pool } = Pg;
  return new Pool({ connectionString });
}
