import {
  coerceSqlParameter,
  type InsertableColumnOptions,
  selectInsertableColumns,
  selectUpdatableColumns
} from '@ts-linq/dialect-kit';
import { calcChunkSize, chunkArray } from '@ts-linq/sql-visitor';
import type {
  BatchInsertResult,
  BatchUpdateResult,
  EntityMetadata,
  SqlParameter,
  SqlWithParams
} from '@ts-linq/types';

import { quoteIdentifier } from './quoting';

/** PostgreSQL hard cap on bind parameters per statement. */
export const PG_PARAM_LIMIT = 65535;

/** PostgreSQL INSERT column policy: computed columns and unset (SERIAL/IDENTITY) PKs are omitted. */
const PG_INSERT_POLICY: InsertableColumnOptions = {
  excludeComputed: true,
  excludeGeneratedPk: true
};

type Entity = Record<string, unknown>;

/** Map ColumnMetadata.type → PostgreSQL cast suffix to resolve CTE type inference. */
function toPgCast(type?: string): string {
  if (!type) return 'text';
  const t = type.toLowerCase();
  if (t === 'integer' || t === 'int' || t === 'number' || t === 'bigint' || t === 'serial')
    return 'integer';
  if (t === 'boolean' || t === 'bool') return 'boolean';
  if (t === 'float' || t === 'real' || t === 'double' || t === 'numeric' || t === 'decimal')
    return 'numeric';
  if (t === 'date') return 'date';
  if (t === 'timestamp') return 'timestamptz';
  if (t === 'blob' || t === 'bytea') return 'bytea';
  return 'text';
}

/**
 * Build a PostgreSQL multi-row INSERT:
 *   INSERT INTO "t" ("c1","c2") VALUES ($1,$2),($3,$4) RETURNING *
 */
export function buildPgBatchInsert(
  entities: Entity[],
  metadata: EntityMetadata
): BatchInsertResult {
  if (entities.length === 0) throw new Error('buildPgBatchInsert: empty entity list');

  const cols = selectInsertableColumns(metadata, entities[0], PG_INSERT_POLICY);
  if (cols.length === 0) throw new Error('buildPgBatchInsert: no insertable columns');

  const parameters: SqlParameter[] = [];
  const rowPlaceholders: string[] = [];
  let idx = 1;

  for (const entity of entities) {
    const rowPh = cols.map(() => `$${idx++}`).join(',');
    rowPlaceholders.push(`(${rowPh})`);
    for (const c of cols) {
      parameters.push(coerceSqlParameter(entity[c.propertyName]));
    }
  }

  const colNames = cols.map((c) => quoteIdentifier(c.columnName)).join(',');
  const sql = `INSERT INTO ${quoteIdentifier(metadata.tableName)} (${colNames}) VALUES ${rowPlaceholders.join(',')} RETURNING *`;
  return { sql, parameters };
}

/**
 * Build a PostgreSQL CTE-based bulk UPDATE:
 *   WITH _batch("pk","c1") AS (VALUES ($1,$2),($3,$4))
 *   UPDATE "t" SET "c1"=_batch."c1" FROM _batch WHERE "t"."pk"=_batch."pk"
 */
export function buildPgBatchUpdate(
  entities: Entity[],
  metadata: EntityMetadata
): BatchUpdateResult {
  if (entities.length === 0) throw new Error('buildPgBatchUpdate: empty entity list');
  if (!metadata.primaryKeys?.length) {
    throw new Error(`buildPgBatchUpdate: no primary key on ${metadata.tableName}`);
  }

  const pks = metadata.primaryKeys;
  const setCols = selectUpdatableColumns(metadata);
  if (setCols.length === 0) throw new Error('buildPgBatchUpdate: no updatable columns');

  const allCols = [
    ...pks.map((pk) => metadata.columns.find((c) => c.propertyName === pk)!),
    ...setCols
  ];

  const parameters: SqlParameter[] = [];
  const rowPlaceholders: string[] = [];
  let idx = 1;

  for (const entity of entities) {
    const rowPh = allCols.map(() => `$${idx++}`).join(',');
    rowPlaceholders.push(`(${rowPh})`);
    for (const c of allCols) {
      parameters.push(coerceSqlParameter(entity[c.propertyName]));
    }
  }

  const cteColNames = allCols.map((c) => quoteIdentifier(c.columnName)).join(',');
  // Add type casts so PostgreSQL can resolve CTE column types correctly
  const setClause = setCols
    .map((c) => {
      const colId = quoteIdentifier(c.columnName);
      return `${colId}=_batch.${colId}::${toPgCast(c.type)}`;
    })
    .join(',');
  const whereClause = pks
    .map((pk) => {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      const colId = quoteIdentifier(col.columnName);
      return `${quoteIdentifier(metadata.tableName)}.${colId}=_batch.${colId}::${toPgCast(col.type)}`;
    })
    .join(' AND ');

  const sql =
    `WITH _batch(${cteColNames}) AS (VALUES ${rowPlaceholders.join(',')}) ` +
    `UPDATE ${quoteIdentifier(metadata.tableName)} SET ${setClause} FROM _batch WHERE ${whereClause}`;

  return { sql, parameters };
}

/**
 * Build a PostgreSQL DELETE with IN clause:
 *   DELETE FROM "t" WHERE "pk" IN ($1,$2,…)
 */
export function buildPgBatchDelete(entities: Entity[], metadata: EntityMetadata): SqlWithParams {
  if (entities.length === 0) throw new Error('buildPgBatchDelete: empty entity list');
  if (!metadata.primaryKeys?.length) {
    throw new Error(`buildPgBatchDelete: no primary key on ${metadata.tableName}`);
  }

  const pk = metadata.primaryKeys[0];
  const pkCol = metadata.columns.find((c) => c.propertyName === pk)!;
  const parameters: SqlParameter[] = entities.map((e) => coerceSqlParameter(e[pk]));
  const placeholders = parameters.map((_, i) => `$${i + 1}`).join(',');
  const sql = `DELETE FROM ${quoteIdentifier(metadata.tableName)} WHERE ${quoteIdentifier(pkCol.columnName)} IN (${placeholders})`;
  return { sql, parameters };
}

/**
 * Split entities into chunks respecting maxBatchSize and PG_PARAM_LIMIT.
 */
export function chunkPgBatch(
  entities: Entity[],
  metadata: EntityMetadata,
  maxBatchSize: number,
  operation: 'insert' | 'update' | 'delete'
): Entity[][] {
  let paramsPerRow: number;
  if (operation === 'insert') {
    const cols = selectInsertableColumns(metadata, entities[0] ?? {}, PG_INSERT_POLICY);
    paramsPerRow = cols.length;
  } else if (operation === 'update') {
    const pks = metadata.primaryKeys ?? [];
    paramsPerRow = pks.length + selectUpdatableColumns(metadata).length;
  } else {
    paramsPerRow = 1; // single PK per DELETE row
  }

  const size = calcChunkSize(paramsPerRow, maxBatchSize, PG_PARAM_LIMIT);
  return chunkArray(entities, size);
}
