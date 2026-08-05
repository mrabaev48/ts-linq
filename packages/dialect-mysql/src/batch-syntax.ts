import {
  coerceSqlParameter,
  type InsertableColumnOptions,
  selectInsertableColumns,
  selectUpdatableColumns
} from '@ts-linq/dialect-kit';
import type {
  BatchInsertResult,
  BatchUpdateResult,
  EntityMetadata,
  SqlParameter,
  SqlWithParams
} from '@ts-linq/types';

import { quoteIdentifier } from './quoting';

/** MySQL practical parameter limit. */
export const MYSQL_PARAM_LIMIT = 65535;

/** MySQL INSERT column policy: computed columns and unset (AUTO_INCREMENT) PKs are omitted. */
const MYSQL_INSERT_POLICY: InsertableColumnOptions = {
  excludeComputed: true,
  excludeGeneratedPk: true
};

type Entity = Record<string, unknown>;

/**
 * Build a MySQL multi-row INSERT:
 *   INSERT INTO `t` (`c1`,`c2`) VALUES (?,?),(?,?)
 * MySQL uses `?` placeholders natively — no conversion needed.
 */
export function buildMysqlBatchInsert(
  entities: Entity[],
  metadata: EntityMetadata
): BatchInsertResult {
  if (entities.length === 0) throw new Error('buildMysqlBatchInsert: empty entity list');

  const cols = selectInsertableColumns(metadata, entities[0], MYSQL_INSERT_POLICY);
  if (cols.length === 0) throw new Error('buildMysqlBatchInsert: no insertable columns');

  const parameters: SqlParameter[] = [];
  const rowPlaceholders: string[] = [];

  for (const entity of entities) {
    rowPlaceholders.push(`(${cols.map(() => '?').join(',')})`);
    for (const c of cols) {
      parameters.push(coerceSqlParameter(entity[c.propertyName], c.propertyName));
    }
  }

  const colNames = cols.map((c) => quoteIdentifier(c.columnName)).join(',');
  const sql = `INSERT INTO ${quoteIdentifier(metadata.tableName)} (${colNames}) VALUES ${rowPlaceholders.join(',')}`;
  // MySQL INSERT does not return rows; caller must use LAST_INSERT_ID() to retrieve generated PKs
  return {
    sql,
    parameters,
    returnsRows: false,
    fetchFirstInsertIdSql: 'SELECT LAST_INSERT_ID() AS first_id'
  };
}

/**
 * Build MySQL UPDATE statements — one per entity (MySQL lacks clean multi-row UPDATE).
 * Returns multiple statements via `BatchUpdateResult.statements`.
 */
export function buildMysqlBatchUpdate(
  entities: Entity[],
  metadata: EntityMetadata
): BatchUpdateResult {
  if (entities.length === 0) throw new Error('buildMysqlBatchUpdate: empty entity list');
  if (!metadata.primaryKeys?.length) {
    throw new Error(`buildMysqlBatchUpdate: no primary key on ${metadata.tableName}`);
  }

  const pks = metadata.primaryKeys;
  const setCols = selectUpdatableColumns(metadata);
  if (setCols.length === 0) throw new Error('buildMysqlBatchUpdate: no updatable columns');

  const statements: Array<{ sql: string; parameters: SqlParameter[] }> = [];

  for (const entity of entities) {
    const setClause = setCols.map((c) => `${quoteIdentifier(c.columnName)}=?`).join(',');
    const whereClause = pks
      .map((pk) => {
        const col = metadata.columns.find((c) => c.propertyName === pk)!;
        return `${quoteIdentifier(col.columnName)}=?`;
      })
      .join(' AND ');

    const sql = `UPDATE ${quoteIdentifier(metadata.tableName)} SET ${setClause} WHERE ${whereClause}`;
    const parameters: SqlParameter[] = [
      ...setCols.map((c) => coerceSqlParameter(entity[c.propertyName], c.propertyName)),
      ...pks.map((pk) => coerceSqlParameter(entity[pk], pk))
    ];

    statements.push({ sql, parameters });
  }

  return { statements };
}

/**
 * Build a MySQL DELETE with IN clause:
 *   DELETE FROM `t` WHERE `pk` IN (?,?,…)
 */
export function buildMysqlBatchDelete(entities: Entity[], metadata: EntityMetadata): SqlWithParams {
  if (entities.length === 0) throw new Error('buildMysqlBatchDelete: empty entity list');
  if (!metadata.primaryKeys?.length) {
    throw new Error(`buildMysqlBatchDelete: no primary key on ${metadata.tableName}`);
  }

  const pk = metadata.primaryKeys[0];
  const pkCol = metadata.columns.find((c) => c.propertyName === pk)!;
  const parameters: SqlParameter[] = entities.map((e) => coerceSqlParameter(e[pk], pk));
  const placeholders = parameters.map(() => '?').join(',');
  const sql = `DELETE FROM ${quoteIdentifier(metadata.tableName)} WHERE ${quoteIdentifier(pkCol.columnName)} IN (${placeholders})`;
  return { sql, parameters };
}
