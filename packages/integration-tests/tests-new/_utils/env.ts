export function sqliteAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('sqlite3');
    return true;
  } catch {
    return false;
  }
}

export const shouldRunSqlite = !!process.env.RUN_DB_TESTS;
