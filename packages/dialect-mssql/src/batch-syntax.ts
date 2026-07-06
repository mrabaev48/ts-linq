import {
  coerceSqlParameter,
  type InsertableColumnOptions,
  numberPlaceholders,
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

/** SQL Server hard cap on bind parameters per statement. */
export const MSSQL_PARAM_LIMIT = 2100;

/** SQL Server INSERT column policy: computed columns and unset (IDENTITY) PKs are omitted. */
const MSSQL_INSERT_POLICY: InsertableColumnOptions = {
  excludeComputed: true,
  excludeGeneratedPk: true
};

type Entity = Record<string, unknown>;

/**
 * Build a SQL Server multi-row INSERT with OUTPUT:
 *   INSERT INTO [t] ([c1],[c2]) OUTPUT INSERTED.[pk] VALUES (@p1,@p2),(@p3,@p4)
 */
export function buildMssqlBatchInsert(
  entities: Entity[],
  metadata: EntityMetadata
): BatchInsertResult {
  if (entities.length === 0) throw new Error('buildMssqlBatchInsert: empty entity list');

  const cols = selectInsertableColumns(metadata, entities[0], MSSQL_INSERT_POLICY);
  if (cols.length === 0) throw new Error('buildMssqlBatchInsert: no insertable columns');

  const parameters: SqlParameter[] = [];
  const rowPlaceholders: string[] = [];

  for (const entity of entities) {
    const rowPh = cols.map(() => '?').join(',');
    rowPlaceholders.push(`(${rowPh})`);
    for (const c of cols) {
      parameters.push(coerceSqlParameter(entity[c.propertyName], c.propertyName));
    }
  }

  const firstPk = metadata.primaryKeys?.[0];
  const pkColMeta = firstPk ? metadata.columns.find((c) => c.propertyName === firstPk) : undefined;

  const colNames = cols.map((c) => quoteIdentifier(c.columnName)).join(',');
  const tableId = quoteIdentifier(metadata.tableName);
  let sql: string;
  if (pkColMeta?.isGenerated) {
    sql = `INSERT INTO ${tableId} (${colNames}) OUTPUT INSERTED.${quoteIdentifier(pkColMeta.columnName)} AS id VALUES ${rowPlaceholders.join(',')}`;
  } else {
    sql = `INSERT INTO ${tableId} (${colNames}) VALUES ${rowPlaceholders.join(',')}`;
  }

  return { sql: numberPlaceholders(sql, '@p'), parameters };
}

/**
 * Build a SQL Server VALUES JOIN bulk UPDATE:
 *   UPDATE t SET t.[c1]=b.[c1]
 *   FROM [t] t JOIN (VALUES (@p1,@p2),(@p3,@p4)) AS b([pk],[c1]) ON t.[pk]=b.[pk]
 */
export function buildMssqlBatchUpdate(
  entities: Entity[],
  metadata: EntityMetadata
): BatchUpdateResult {
  if (entities.length === 0) throw new Error('buildMssqlBatchUpdate: empty entity list');
  if (!metadata.primaryKeys?.length) {
    throw new Error(`buildMssqlBatchUpdate: no primary key on ${metadata.tableName}`);
  }

  const pks = metadata.primaryKeys;
  const setCols = selectUpdatableColumns(metadata);
  if (setCols.length === 0) throw new Error('buildMssqlBatchUpdate: no updatable columns');

  const allCols = [
    ...pks.map((pk) => metadata.columns.find((c) => c.propertyName === pk)!),
    ...setCols
  ];

  const parameters: SqlParameter[] = [];
  const rowPlaceholders: string[] = [];

  for (const entity of entities) {
    const rowPh = allCols.map(() => '?').join(',');
    rowPlaceholders.push(`(${rowPh})`);
    for (const c of allCols) {
      parameters.push(coerceSqlParameter(entity[c.propertyName], c.propertyName));
    }
  }

  const bColNames = allCols.map((c) => quoteIdentifier(c.columnName)).join(',');
  const setClause = setCols
    .map((c) => {
      const colId = quoteIdentifier(c.columnName);
      return `t.${colId}=b.${colId}`;
    })
    .join(',');
  const onClause = pks
    .map((pk) => {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      const colId = quoteIdentifier(col.columnName);
      return `t.${colId}=b.${colId}`;
    })
    .join(' AND ');

  const sql =
    `UPDATE t SET ${setClause} ` +
    `FROM ${quoteIdentifier(metadata.tableName)} t ` +
    `JOIN (VALUES ${rowPlaceholders.join(',')}) AS b(${bColNames}) ON ${onClause}`;

  return { sql: numberPlaceholders(sql, '@p'), parameters };
}

/**
 * Build a SQL Server DELETE with IN clause:
 *   DELETE FROM [t] WHERE [pk] IN (@p1,@p2,…)
 */
export function buildMssqlBatchDelete(entities: Entity[], metadata: EntityMetadata): SqlWithParams {
  if (entities.length === 0) throw new Error('buildMssqlBatchDelete: empty entity list');
  if (!metadata.primaryKeys?.length) {
    throw new Error(`buildMssqlBatchDelete: no primary key on ${metadata.tableName}`);
  }

  const pk = metadata.primaryKeys[0];
  const pkCol = metadata.columns.find((c) => c.propertyName === pk)!;
  const parameters: SqlParameter[] = entities.map((e) => coerceSqlParameter(e[pk], pk));
  const placeholders = parameters.map(() => '?').join(',');
  const sql = numberPlaceholders(
    `DELETE FROM ${quoteIdentifier(metadata.tableName)} WHERE ${quoteIdentifier(pkCol.columnName)} IN (${placeholders})`,
    '@p'
  );
  return { sql, parameters };
}

/**
 * Split entities into chunks respecting maxBatchSize and MSSQL_PARAM_LIMIT.
 */
export function chunkMssqlBatch(
  entities: Entity[],
  metadata: EntityMetadata,
  maxBatchSize: number,
  operation: 'insert' | 'update' | 'delete'
): Entity[][] {
  let paramsPerRow: number;
  if (operation === 'insert') {
    const cols = selectInsertableColumns(metadata, entities[0] ?? {}, MSSQL_INSERT_POLICY);
    paramsPerRow = cols.length;
  } else if (operation === 'update') {
    const pks = metadata.primaryKeys ?? [];
    paramsPerRow = pks.length + selectUpdatableColumns(metadata).length;
  } else {
    paramsPerRow = 1;
  }

  const size = calcChunkSize(paramsPerRow, maxBatchSize, MSSQL_PARAM_LIMIT);
  return chunkArray(entities, size);
}
