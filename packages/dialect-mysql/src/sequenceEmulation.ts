/**
 * MySQL sequence emulation via a counter table.
 *
 * Since MySQL does not have native sequences, we emulate them with a dedicated
 * table `__ts_linq_sequences` containing a row per sequence. A single UPDATE +
 * SELECT within the same transaction reserves the next block atomically.
 *
 * The caller is responsible for ensuring this table exists before first use.
 * Migrations emit the CREATE TABLE below when a sequence is declared on MySQL.
 */

export const MYSQL_SEQUENCE_TABLE = '__ts_linq_sequences';

/** DDL to create the emulation table (emitted by migrations). */
export const MYSQL_SEQUENCE_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS \`${MYSQL_SEQUENCE_TABLE}\` (
  \`name\`           VARCHAR(128) NOT NULL,
  \`schema_name\`    VARCHAR(128)          DEFAULT NULL,
  \`current_value\`  BIGINT       NOT NULL DEFAULT 0,
  \`increment_by\`   INT          NOT NULL DEFAULT 1,
  PRIMARY KEY (\`name\`)
) ENGINE=InnoDB
`.trim();

/**
 * Returns the SQL pair needed to atomically reserve the next block.
 *
 * The UPDATE advances `current_value` by `blockSize`, then the SELECT reads the
 * new value — which is the high-water mark of the reserved block.
 *
 * These two statements MUST be executed inside the same connection/transaction
 * (or at minimum the same session variable scope).
 */
export function buildMysqlNextBlockSql(
  sequenceName: string,
  blockSize: number
): {
  updateSql: string;
  selectSql: string;
  params: unknown[];
} {
  const updateSql = `UPDATE \`${MYSQL_SEQUENCE_TABLE}\` SET \`current_value\` = \`current_value\` + ? WHERE \`name\` = ?`;
  const selectSql = `SELECT \`current_value\` AS val FROM \`${MYSQL_SEQUENCE_TABLE}\` WHERE \`name\` = ?`;
  return { updateSql, selectSql, params: [blockSize, sequenceName] };
}

/**
 * Returns the SQL to ensure a sequence row exists in the emulation table.
 * Safe to call multiple times (INSERT IGNORE semantics).
 */
export function buildMysqlEnsureSequenceSql(
  sequenceName: string,
  schema: string | undefined,
  startsAt: number,
  incrementsBy: number
): { sql: string; params: unknown[] } {
  const sql = `
INSERT INTO \`${MYSQL_SEQUENCE_TABLE}\` (\`name\`, \`schema_name\`, \`current_value\`, \`increment_by\`)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE \`name\` = \`name\`
`.trim();
  return {
    sql,
    params: [sequenceName, schema ?? null, (startsAt ?? 1) - 1, incrementsBy ?? 1]
  };
}
