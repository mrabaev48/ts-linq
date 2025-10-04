import type {
  EntityMetadata,
  RetryPolicy,
  SqlParameter,
  OrmMiddleware,
  SoftDeleteOptions,
  SqlLogger,
  SqlDialect
} from '@ts-linq/core';
import {
  DatabaseProvider,
  OptimisticConcurrencyError,
  MetadataStorage,
  QueryBuilder
} from '@ts-linq/core';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { PostgresDdlStrategy } from '@ts-linq/dialect-postgres';
import type { PgPoolLike } from '../pg/PoolAdapter';
import { createPgPool } from '../pg/PoolAdapter';
import { mapPgError } from '../pg/ErrorMapper';

export class PostgresProvider extends DatabaseProvider {
  private pool!: PgPoolLike;
  private qb: QueryBuilder;
  private ddl = new PostgresDdlStrategy();
  private mapRowToEntity<T extends object>(row: unknown, entityClass: new () => T): T {
    const entity = new entityClass();
    const meta = MetadataStorage.getEntity(entityClass);
    if (meta) {
      for (const col of meta.columns) {
        if (Object.prototype.hasOwnProperty.call(row as object, col.columnName)) {
          (entity as Record<string, unknown>)[col.propertyName] = convertValueFromPg(
            (row as Record<string, unknown>)[col.columnName],
            col.type
          );
        }
      }
    } else {
      Object.assign(entity as object, row as object);
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.notifyEntityMaterialized(entity, meta);
    return entity;
  }

  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy
  ) {
    super(connectionString, logger, middlewares, softDelete, retryPolicy);
    this.qb = new QueryBuilder(this.getDialect());
    this.providerName = 'postgresql';
  }

  private coerceToSqlParameter(value: unknown): SqlParameter {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      value instanceof Uint8Array
    ) {
      return value as SqlParameter;
    }
    try {
      return JSON.stringify(value ?? null) as unknown as SqlParameter;
    } catch {
      return String(value) as unknown as SqlParameter;
    }
  }

  public async connect(): Promise<void> {
    this.pool = createPgPool(this.connectionString);
    this.isConnected = true;
    await Promise.resolve();
  }

  public async disconnect(): Promise<void> {
    if (this.pool) await this.pool.end();
    this.isConnected = false;
  }

  public async createTable(entityMetadata: EntityMetadata): Promise<void> {
    const sql = this.ddl.generateCreateTableSql(entityMetadata);
    await this.executeNonQuery(sql);
    for (const index of entityMetadata.indexes) {
      const idxSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, index);
      await this.executeNonQuery(idxSql);
    }
  }

  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const cols = meta.columns.filter((c) => !c.isGenerated && !c.isComputed);
    const names = cols.map((c) => `"${c.columnName}"`);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const values: SqlParameter[] = cols.map((c) =>
      this.coerceToSqlParameter(
        convertValueForPg((entity as Record<string, unknown>)[c.propertyName], c.type)
      )
    );
    const sql = `INSERT INTO "${meta.tableName}" (${names.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
    const rows = await this.executeQuery<Record<string, unknown>>(sql, values);
    Object.assign(entity as object, rows[0] as object);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.notifyEntityMaterialized(entity, meta);
    return entity;
  }

  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const versionCol = meta.columns.find((c) => c.isVersion);
    const setCols = meta.columns.filter(
      (c) => !meta.primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    if (setCols.length === 0) return entity;
    const sets = setCols.map((c, i) => `"${c.columnName}" = $${i + 1}`);
    const setVals: SqlParameter[] = setCols.map((c) =>
      this.coerceToSqlParameter(
        convertValueForPg((entity as Record<string, unknown>)[c.propertyName], c.type)
      )
    );
    if (versionCol) {
      sets.push(`"${versionCol.columnName}" = "${versionCol.columnName}" + 1`);
    }
    const where = meta.primaryKeys.map(
      (pk, i) =>
        `"${meta.columns.find((c) => c.propertyName === pk)?.columnName || pk}" = $${setCols.length + i + 1}`
    );
    const whereVals: SqlParameter[] = meta.primaryKeys.map((pk) =>
      this.coerceToSqlParameter((entity as Record<string, unknown>)[pk])
    );
    let sql = `UPDATE "${meta.tableName}" SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`;
    if (versionCol) {
      sql += ` AND "${versionCol.columnName}" = $${setCols.length + meta.primaryKeys.length + 1}`;
      whereVals.push(
        this.coerceToSqlParameter((entity as Record<string, unknown>)[versionCol.propertyName])
      );
    }
    const affected = await this.executeNonQuery(sql, [...setVals, ...whereVals]);
    if (affected === 0) {
      if (versionCol) throw new OptimisticConcurrencyError();
      throw new Error('No rows were updated. Not found or no changes.');
    }
    if (versionCol) {
      const prop = versionCol.propertyName;
      const rec = entity as Record<string, unknown>;
      const cur = typeof rec[prop] === 'number' ? rec[prop] : Number(rec[prop] ?? 0);
      rec[prop] = cur + 1;
    }
    return entity;
  }

  public async upsert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!meta.primaryKeys || meta.primaryKeys.length === 0) {
      return this.insert(entity, entityClass);
    }
    const insertCols = meta.columns.filter((c) => !c.isGenerated && !c.isComputed);
    const names = insertCols.map((c) => `"${c.columnName}"`);
    const placeholders = insertCols.map((_, i) => `$${i + 1}`);
    const values: SqlParameter[] = insertCols.map((c) =>
      this.coerceToSqlParameter(
        convertValueForPg((entity as Record<string, unknown>)[c.propertyName], c.type)
      )
    );
    const conflictTargets = meta.primaryKeys
      .map((pk) => `"${meta.columns.find((c) => c.propertyName === pk)?.columnName || pk}"`)
      .join(', ');
    const setCols = meta.columns.filter(
      (c) => !meta.primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    const setClause = setCols
      .map((c) => `"${c.columnName}" = EXCLUDED."${c.columnName}"`)
      .join(', ');
    const sql = `INSERT INTO "${meta.tableName}" (${names.join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT (${conflictTargets}) DO UPDATE SET ${setClause} RETURNING *`;
    const rows = await this.executeQuery<Record<string, unknown>>(sql, values);
    if (rows[0]) Object.assign(entity as object, rows[0] as object);
    return entity;
  }

  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const where = meta.primaryKeys.map(
      (pk, i) =>
        `"${meta.columns.find((c) => c.propertyName === pk)?.columnName || pk}" = $${i + 1}`
    );
    const vals: SqlParameter[] = meta.primaryKeys.map((pk) =>
      this.coerceToSqlParameter((entity as Record<string, unknown>)[pk])
    );
    const sql = `DELETE FROM "${meta.tableName}" WHERE ${where.join(' AND ')}`;
    await this.executeNonQuery(sql, vals);
  }

  public getDialect(): SqlDialect {
    return new PostgresDialect();
  }

  public async findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const pk = meta.primaryKeys[0];
    const col = meta.columns.find((c) => c.propertyName === pk)?.columnName || pk;
    let sql = `SELECT * FROM "${meta.tableName}" WHERE "${col}" = $1`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND "${flag}" = FALSE`;
    }
    const rows = await this.executeQuery<Record<string, unknown>>(sql, [
      this.coerceToSqlParameter(id)
    ]);
    const firstRow = rows[0];
    if (!firstRow) return null;
    const entity = this.mapRowToEntity(firstRow, entityClass);
    return entity;
  }

  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    let sql = `SELECT * FROM "${meta.tableName}"`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` WHERE "${flag}" = FALSE`;
    }
    const rows = await this.executeQuery<Record<string, unknown>>(sql);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  public async findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const keys = Object.keys(conditions);
    const clauses = keys.map(
      (k, i) =>
        `"${
          meta.columns.find((c) => c.propertyName === k || c.columnName === k)?.columnName || k
        }" = $${i + 1}`
    );
    const vals = keys.map((k) => this.coerceToSqlParameter(conditions[k]));
    let sql = `SELECT * FROM "${meta.tableName}" WHERE ${clauses.join(' AND ')}`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND "${flag}" = FALSE`;
    }
    const rows = await this.executeQuery<Record<string, unknown>>(sql, vals);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  public async findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]> {
    if (!values || values.length === 0) return [];
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const col =
      meta.columns.find((c) => c.propertyName === column || c.columnName === column)?.columnName ||
      column;
    let sql = `SELECT * FROM "${meta.tableName}" WHERE "${col}" = ANY($1)`;
    if (this.softDelete?.enabled) {
      const flag = this.softDelete.column ?? 'isDeleted';
      const has = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
      if (has) sql += ` AND "${flag}" = FALSE`;
    }
    const rows = await this.executeQuery<Record<string, unknown>>(sql, [
      values as unknown as SqlParameter
    ]);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    try {
      const res = await this.pool.query<T>(sql, params);
      return res.rows;
    } catch (e: unknown) {
      throw mapPgError(e);
    }
  }

  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    try {
      const res = await this.pool.query(sql, params);
      return res.rowCount;
    } catch (e: unknown) {
      throw mapPgError(e);
    }
  }

  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) throw new Error('Transaction already in progress');
    this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await this.executeNonQuery('BEGIN');
    this.inTransaction = true;
    this.logger?.transactionStart?.({ traceId: this.currentTraceId, provider: this.providerName });
  }
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    await this.executeNonQuery('COMMIT');
    this.inTransaction = false;
    const tid = this.currentTraceId;
    this.currentTraceId = undefined;
    this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
  }
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    await this.executeNonQuery('ROLLBACK');
    this.inTransaction = false;
    const tid = this.currentTraceId;
    this.currentTraceId = undefined;
    this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
  }
}

function convertValueForPg(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return value;
  switch (type.toUpperCase()) {
    case 'JSON':
    case 'JSONB':
      return typeof value === 'string' ? value : JSON.stringify(value);
    default:
      return value;
  }
}

function convertValueFromPg(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return value;
  switch (type.toUpperCase()) {
    case 'BOOLEAN':
      return Boolean(value);
    case 'INTEGER':
    case 'NUMBER':
      return typeof value === 'number' ? value : Number(value as unknown as string);
    case 'TIMESTAMPTZ':
    case 'DATETIME':
    case 'DATE':
      return value instanceof Date ? value : new Date(value as unknown as string);
    case 'JSONB':
    case 'JSON':
      return typeof value === 'string' ? JSON.parse(value) : value;
    default:
      return value;
  }
}
