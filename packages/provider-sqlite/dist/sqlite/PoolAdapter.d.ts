export interface SqliteDbLike {
  run(
    sql: string,
    params?: unknown,
    cb?: (
      this: {
        changes: number;
      },
      err: Error | null
    ) => void
  ): void;
  all(sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void): void;
  close(cb: (err?: Error | null) => void): void;
}
export declare function createSqliteDb(connectionString: string): SqliteDbLike;
//# sourceMappingURL=PoolAdapter.d.ts.map
