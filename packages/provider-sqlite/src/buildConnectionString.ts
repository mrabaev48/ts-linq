import type { SQLiteConfig } from '@ts-linq/types';

/**
 * Builds SQLite connection string from configuration object.
 * 
 * @param config - SQLite configuration
 * @returns Connection string for sqlite3 driver
 * 
 * @example
 * buildSqliteConnectionString({ file: ':memory:' }) // => ':memory:'
 * buildSqliteConnectionString({ file: './data.db', mode: 'readonly' }) // => './data.db'
 */
export function buildSqliteConnectionString(config: SQLiteConfig): string {
  // For SQLite, the connection string is primarily the file path
  // Mode and busyTimeout are handled via PRAGMA statements after connection
  if (config.file === ':memory:' || config.mode === 'memory') {
    return ':memory:';
  }
  
  return config.file;
}
