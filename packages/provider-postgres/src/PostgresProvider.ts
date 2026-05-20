import { DatabaseProvider } from '@ts-linq/core';
import { PostgresDdlStrategy, PostgresDialect } from '@ts-linq/dialect-postgres';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata, PostgresConfig, SqlDialect, SqlParameter } from '@ts-linq/types';
import {
  DatabaseError,
  ForeignKeyConstraintError,
  OptimisticConcurrencyError,
  UniqueConstraintError
} from '@ts-linq/types';

import { buildPostgresConnectionString } from './buildConnectionString';

// Lazy require to avoid hard dependency if not installed
let Pg: {
  Pool: new (cfg: { connectionString: string }) => PgPoolLike;
};
try {
  Pg = require('pg');
} catch (e) {
  try {
    const { warnIfLoggerDebug } = require('../utils/MetricsSafe') as {
      warnIfLoggerDebug: (method: string, error: unknown) => void;
    };
    warnIfLoggerDebug('require(pg)', e);
  } catch {
    /* ignore */
  }
}

interface PgQueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}
interface PgClientLike {
  query<T = unknown>(sql: string, params?: readonly SqlParameter[]): Promise<PgQueryResult<T>>;
  release(): void;
}
interface PgPoolLike {
  query<T = unknown>(sql: string, params?: readonly SqlParameter[]): Promise<PgQueryResult<T>>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
}

/**
 * PostgreSQL provider backed by `pg` Pool.
 *
 * Responsibilities:
 * - Connection lifecycle and transaction control
 * - DDL for simple table/index creation (prefer migrations for production)
 * - CRUD helpers using parameterized SQL ($1..$n)
 * - Convenience findWhere/findWhereIn APIs
 * - Basic value conversions for common types (JSON/JSONB/TIMESTAMPTZ)
 */
export class PostgresProvider extends DatabaseProvider {
  private pool!: PgPoolLike;
  private transactionClient?: PgClientLike;
  private ddl = new PostgresDdlStrategy();
  private readonly config: PostgresConfig;
  private ownsPool = true;

  /** Map a row object to a new entity instance using entity metadata and notify middleware. */
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

  constructor(config: PostgresConfig) {
    const connectionString = buildPostgresConnectionString(config);
    super(
      connectionString,
      config.logger,
      config.middlewares,
      config.softDelete,
      config.retryPolicy,
      config.poolOptions,
      config.healthCheck
    );
    this.config = config;
    this.providerName = 'postgresql';
  }

  public override formatSqlWithParams(
    rawSql: string,
    params: readonly SqlParameter[]
  ): { sql: string; params: readonly SqlParameter[] } {
    let index = 0;
    return { sql: rawSql.replace(/\?/g, () => `$${++index}`), params };
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
      return value;
    }
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return String(value);
    }
  }

  /** Open a connection pool to PostgreSQL using the connection string, or use injected pool. */
  public async connect(): Promise<void> {
    if (this.config.pool) {
      this.pool = this.config.pool as PgPoolLike;
      this.ownsPool = false;
    } else {
      if (!Pg) throw new Error('pg module is not installed');
      const { Pool } = Pg;
      const poolOpts = this.poolOptions || {};
      // Map generic pool options to pg.Pool config when available
      const pgConfig: Record<string, unknown> = { connectionString: this.connectionString };
      if (typeof poolOpts.max === 'number') pgConfig.max = poolOpts.max;
      if (typeof poolOpts.idleTimeoutMs === 'number')
        pgConfig.idleTimeoutMillis = poolOpts.idleTimeoutMs;
      if (typeof poolOpts.connectionTimeoutMs === 'number')
        pgConfig.connectionTimeoutMillis = poolOpts.connectionTimeoutMs;
      this.pool = new Pool(pgConfig as { connectionString: string });
      this.ownsPool = true;
    }

    this.isConnected = true;
    // Start health checks if enabled
    await (async () => {
      // ensure at least one awaited async in connect() for lint rule
      /* noop */
    })();
    this.startHealthChecks(async () => {
      const started = Date.now();
      const sql = 'SELECT 1';
      await this.pool.query(sql);
      return Date.now() - started;
    });
  }

  /** Gracefully dispose of the connection pool. */
  public async disconnect(): Promise<void> {
    this.stopHealthChecks();
    if (this.pool && this.ownsPool) {
      await this.pool.end();
    }
    this.isConnected = false;
  }

  /**
   * Create a table for the given entity metadata when it does not exist.
   * Also ensures declared indexes exist. For complex schemas prefer migrations.
   */
  public async createTable(entityMetadata: EntityMetadata): Promise<void> {
    const sql = this.ddl.generateCreateTableSql(entityMetadata);
    await this.executeNonQuery(sql);

    // Create indexes
    for (const index of entityMetadata.indexes) {
      const idxSql = this.ddl.generateCreateIndexSql(entityMetadata.tableName, {
        columns: index.columns,
        unique: index.unique ?? false,
        name: index.name
      });
      await this.executeNonQuery(idxSql);
    }
  }

  /** Insert an entity row and return the populated entity (RETURNING *). */
  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const dialect = this.getDialect();
    if (!dialect.buildInsert) throw new Error('Dialect does not support buildInsert');

    const { sql, parameters } = dialect.buildInsert(entity as Record<string, unknown>, meta);
    const rows = await this.executeQuery<Record<string, unknown>>(sql, parameters);
    Object.assign(entity as object, rows[0] as object);
    // notify materialized of inserted row state
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.notifyEntityMaterialized(entity, meta);
    return entity;
  }

  /** Update a row by primary key; supports optimistic concurrency via version column. */
  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const dialect = this.getDialect();
    if (!dialect.buildUpdate) throw new Error('Dialect does not support buildUpdate');

    const versionCol = meta.columns.find((c) => c.isVersion);
    const { sql, parameters } = dialect.buildUpdate(
      entity as Record<string, unknown>,
      meta,
      versionCol
    );

    const affected = await this.executeNonQuery(sql, parameters);
    if (affected === 0) {
      if (versionCol)
        throw new OptimisticConcurrencyError('Version mismatch detected during update');
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

  /** Upsert using INSERT ... ON CONFLICT (pk...) DO UPDATE SET ... RETURNING *. */
  public async upsert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!meta.primaryKeys || meta.primaryKeys.length === 0) {
      return this.insert(entity, entityClass);
    }
    const primaryKeys = meta.primaryKeys;
    // Include generated PK columns when the entity already has a value (upsert with known PK).
    const insertCols = meta.columns.filter(
      (c) =>
        !c.isComputed &&
        (!c.isGenerated || (entity as Record<string, unknown>)[c.propertyName] !== undefined)
    );
    const names = insertCols.map((c) => `"${c.columnName}"`);
    const placeholders = insertCols.map((_, i) => `$${i + 1}`);
    const values: SqlParameter[] = insertCols.map((c) =>
      this.coerceToSqlParameter(
        convertValueForPg((entity as Record<string, unknown>)[c.propertyName], c.type)
      )
    );
    const conflictTargets = primaryKeys
      .map((pk) => `"${meta.columns.find((c) => c.propertyName === pk)?.columnName || pk}"`)
      .join(', ');
    const setCols = meta.columns.filter(
      (c) => !primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    const setClause = setCols
      .map((c) => `"${c.columnName}" = EXCLUDED."${c.columnName}"`)
      .join(', ');
    const sql = `INSERT INTO "${meta.tableName}" (${names.join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT (${conflictTargets}) DO UPDATE SET ${setClause} RETURNING *`;
    const rows = await this.executeQuery<Record<string, unknown>>(sql, values);
    if (rows[0]) Object.assign(entity as object, rows[0] as object);
    return entity;
  }

  /** Delete a row by primary key. */
  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const dialect = this.getDialect();
    if (!dialect.buildDelete) throw new Error('Dialect does not support buildDelete');

    const { sql, parameters } = dialect.buildDelete(entity as Record<string, unknown>, meta);
    await this.executeNonQuery(sql, parameters);
  }

  /** Provide SQL dialect for this provider. */
  public getDialect(): SqlDialect {
    return new PostgresDialect();
  }

  /** Fetch a single row by its primary key value. */
  public async findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    if (!meta.primaryKeys || meta.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for ${entityClass.name}`);
    }
    const pk = meta.primaryKeys[0];
    const col = meta.columns.find((c) => c.propertyName === pk)?.columnName || pk;

    const where: import('@ts-linq/types').WhereClause[] = [
      { condition: `"${col}" = ?`, parameters: [this.coerceToSqlParameter(id)] }
    ];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where, limit: 1 });
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);

    const firstRow = rows[0];
    if (!firstRow) return null;
    return this.mapRowToEntity(firstRow, entityClass);
  }

  /** Fetch all rows for the given entity type. */
  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const where: import('@ts-linq/types').WhereClause[] = [];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where });
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  /** Find rows by simple equality conditions { column: value }. */
  public async findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const keys = Object.keys(conditions);
    const where: import('@ts-linq/types').WhereClause[] = keys.map((k) => {
      const colName =
        meta.columns.find((c) => c.propertyName === k || c.columnName === k)?.columnName || k;
      return {
        condition: `"${colName}" = ?`,
        parameters: [this.coerceToSqlParameter(conditions[k])]
      };
    });

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where });
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  /** Find rows where a column equals any of provided values using Postgres ANY($1). */
  public async findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]> {
    if (!values || values.length === 0) return [];
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity metadata not found for ${entityClass.name}`);

    const colName =
      meta.columns.find((c) => c.propertyName === column || c.columnName === column)?.columnName ||
      column;

    const where: import('@ts-linq/types').WhereClause[] = [
      {
        condition: `"${colName}" = ANY(?)`,
        parameters: [values as unknown as SqlParameter]
      }
    ];

    const dialect = this.getDialect();
    const { query, parameters } = dialect.buildSelect(entityClass, { where });
    const rows = await this.executeQuery<Record<string, unknown>>(query, parameters);
    return rows.map((r) => this.mapRowToEntity(r, entityClass));
  }

  /** Low-level query execution returning rows. */
  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    try {
      const runner = this.transactionClient ?? this.pool;
      const res = await runner.query<T>(sql, params);
      return res.rows;
    } catch (e: unknown) {
      throw mapPgError(e);
    }
  }

  /** Low-level non-query execution returning rowCount. */
  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    try {
      const runner = this.transactionClient ?? this.pool;
      const res = await runner.query(sql, params);
      return res.rowCount;
    } catch (e: unknown) {
      throw mapPgError(e);
    }
  }

  /** Obtain PostgreSQL EXPLAIN (FORMAT JSON) plan when possible. */
  protected async getExplainPlan(
    sql: string,
    params: readonly SqlParameter[]
  ): Promise<unknown | undefined> {
    try {
      const explainSql = `EXPLAIN (FORMAT JSON) ${sql}`;
      const rows = await this.doExecuteQuery<Record<string, unknown>>(explainSql, params);
      const first = rows && rows[0];
      if (!first) return undefined;
      // Typical shape: { 'QUERY PLAN': [ { Plan: {...} } ] }
      const key = Object.keys(first).find((k) => k.toUpperCase().includes('QUERY PLAN'));
      return key ? first[key] : first;
    } catch {
      return undefined;
    }
  }

  /** Begin a transaction (sets a trace id for logging). */
  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) throw new Error('Transaction already in progress');
    if (!this.pool) throw new Error('Provider is not connected');
    const client = await this.pool.connect();
    try {
      this.transactionClient = client;
      this.inTransaction = true;
      this.currentTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await this.executeNonQuery('BEGIN');
      this.logger?.transactionStart?.({
        traceId: this.currentTraceId,
        provider: this.providerName
      });
    } catch (e) {
      this.transactionClient = undefined;
      this.inTransaction = false;
      this.currentTraceId = undefined;
      client.release();
      throw e;
    }
  }
  /** Commit the current transaction. */
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    const client = this.transactionClient;
    if (!client) throw new Error('Invariant violation: transaction client is missing');
    await this.executeNonQuery('COMMIT');
    this.inTransaction = false;
    this.transactionClient = undefined;
    const tid = this.currentTraceId;
    this.currentTraceId = undefined;
    this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
    client.release();
  }
  /** Roll back the current transaction. */
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction) throw new Error('No transaction in progress');
    const client = this.transactionClient;
    if (!client) throw new Error('Invariant violation: transaction client is missing');
    await this.executeNonQuery('ROLLBACK');
    this.inTransaction = false;
    this.transactionClient = undefined;
    const tid = this.currentTraceId;
    this.currentTraceId = undefined;
    this.logger?.transactionEnd?.({ traceId: tid, provider: this.providerName });
    client.release();
  }
}

/** Convert JS value to a PostgreSQL parameter according to column type. */
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

/** Convert PostgreSQL value to a JS runtime value according to mapped type. */
function convertValueFromPg(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return value;
  switch (type.toUpperCase()) {
    case 'BOOLEAN':
      return Boolean(value);
    case 'INTEGER':
    case 'NUMBER':
      return typeof value === 'number' ? value : Number(value);
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

function mapPgError(err: unknown): Error {
  const anyErr = err as { code?: string; message?: string } | undefined;
  const code = anyErr?.code;
  const message = anyErr?.message || String(err);
  if (code === '23505') return new UniqueConstraintError(message, code);
  if (code === '23503') return new ForeignKeyConstraintError(message, code);
  return new DatabaseError(message ?? 'Unknown error');
}

// (removed legacy free function mapRowToEntity; instance method is used)
