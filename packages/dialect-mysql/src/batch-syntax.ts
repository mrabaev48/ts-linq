import { calcChunkSize, chunkArray } from '@ts-linq/sql-visitor';
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

type Entity = Record<string, unknown>;

function coerce(value: unknown): SqlParameter {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

function insertableCols(metadata: EntityMetadata, entity: Entity) {
  const pks = new Set<string>(metadata.primaryKeys ?? []);
  return metadata.columns.filter((c) => {
    if (c.isComputed) return false;
    const v = entity[c.propertyName];
    if (c.isGenerated && (v === null || v === undefined)) return false;
    if (pks.has(c.propertyName) && (v === null || v === undefined)) return false;
    return true;
  });
}

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

  const cols = insertableCols(metadata, entities[0]);
  if (cols.length === 0) throw new Error('buildMysqlBatchInsert: no insertable columns');

  const parameters: SqlParameter[] = [];
  const rowPlaceholders: string[] = [];

  for (const entity of entities) {
    rowPlaceholders.push(`(${cols.map(() => '?').join(',')})`);
    for (const c of cols) {
      parameters.push(coerce(entity[c.propertyName]));
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
  const setCols = metadata.columns.filter(
    (c) => !pks.includes(c.propertyName) && !c.isGenerated && !c.isComputed
  );
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
      ...setCols.map((c) => coerce(entity[c.propertyName])),
      ...pks.map((pk) => coerce(entity[pk]))
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
  const parameters: SqlParameter[] = entities.map((e) => coerce(e[pk]));
  const placeholders = parameters.map(() => '?').join(',');
  const sql = `DELETE FROM ${quoteIdentifier(metadata.tableName)} WHERE ${quoteIdentifier(pkCol.columnName)} IN (${placeholders})`;
  return { sql, parameters };
}

/**
 * Split entities into chunks respecting maxBatchSize and MYSQL_PARAM_LIMIT.
 */
export function chunkMysqlBatch(
  entities: Entity[],
  metadata: EntityMetadata,
  maxBatchSize: number,
  operation: 'insert' | 'update' | 'delete'
): Entity[][] {
  let paramsPerRow: number;
  if (operation === 'insert') {
    const cols = insertableCols(metadata, entities[0] ?? {});
    paramsPerRow = cols.length;
  } else if (operation === 'update') {
    const pks = metadata.primaryKeys ?? [];
    const setCols = metadata.columns.filter(
      (c) => !pks.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    paramsPerRow = pks.length + setCols.length;
  } else {
    paramsPerRow = 1;
  }

  const size = calcChunkSize(paramsPerRow, maxBatchSize, MYSQL_PARAM_LIMIT);
  return chunkArray(entities, size);
}
