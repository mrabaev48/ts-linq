import type { Dialect } from '../Dialect';

/**
 * The single source of truth for the migration bookkeeping table.
 *
 * Both the {@link DefaultMigrationHistoryStore} (which the runner uses at apply/rollback time)
 * and the `IdempotentEmitter` (which generates re-runnable `.sql` scripts) consume these
 * definitions, so the table name and column types cannot drift between the two code paths.
 */
export const MIGRATIONS_TABLE = '__migrations';

/**
 * Builds the canonical `CREATE TABLE` statement for the {@link MIGRATIONS_TABLE} bookkeeping
 * table for a given dialect.
 *
 * The statement is idempotent (`IF NOT EXISTS` / `IF NOT EXISTS (... sys.tables ...)`), so it is
 * safe to run on every `migrate()`/`rollback()`. The table name is a fixed internal constant —
 * never user-supplied — so it is embedded directly rather than routed through the quoting layer.
 *
 * @param dialect Target database dialect.
 */
export function buildEnsureMigrationsTableSql(dialect: Dialect): string {
  if (dialect === 'mssql') {
    return `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '${MIGRATIONS_TABLE}')
BEGIN
    CREATE TABLE ${MIGRATIONS_TABLE} (
        version NVARCHAR(50) NOT NULL PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        applied_at NVARCHAR(50) NOT NULL
    )
END`;
  }

  // PostgreSQL and MySQL — standard IF NOT EXISTS syntax.
  // MySQL requires VARCHAR with explicit length for indexed/primary-key columns,
  // whereas PostgreSQL can use unbounded TEXT.
  const vt = dialect === 'mysql' ? 'VARCHAR(50)' : 'TEXT';
  const nt = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT';
  const dt = dialect === 'mysql' ? 'VARCHAR(50)' : 'TEXT';
  return `
CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
    version ${vt} PRIMARY KEY,
    name ${nt} NOT NULL,
    applied_at ${dt} NOT NULL
)`;
}
