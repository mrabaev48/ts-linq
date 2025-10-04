export interface SqliteDbLike {
  run(sql: string, params?: unknown, cb?: (this: { changes: number }, err: Error | null) => void): void;
  all(sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void): void;
  close(cb: (err?: Error | null) => void): void;
}

export function createSqliteDb(connectionString: string): SqliteDbLike {
  const sqlite3 = safeRequireSqlite3();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const db = new (sqlite3 as any).Database(connectionString, () => {});
  return db as unknown as SqliteDbLike;
}

function safeRequireSqlite3(): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('sqlite3');
  } catch {
    throw new Error('Package "sqlite3" is required for SQLiteProvider. Install it with: npm install sqlite3');
  }
}


