export function createSqliteDb(connectionString) {
  const sqlite3 = safeRequireSqlite3();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const db = new sqlite3.Database(connectionString, () => {});
  return db;
}
function safeRequireSqlite3() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('sqlite3');
  } catch {
    throw new Error(
      'Package "sqlite3" is required for SQLiteProvider. Install it with: npm install sqlite3'
    );
  }
}
//# sourceMappingURL=PoolAdapter.js.map
