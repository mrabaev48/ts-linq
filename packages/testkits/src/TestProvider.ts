import type { CircuitBreakerOptions } from '@ts-linq/core';
import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type {
  BatchInsertResult,
  BatchUpdateResult,
  BulkDeleteContext,
  BulkUpdateContext,
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  EntityMetadata,
  OrmMiddleware,
  QueryOptions,
  RetryPolicy,
  SoftDeleteOptions,
  SqlDialect,
  SqlLogger,
  SqlParameter,
  SqlWithParams
} from '@ts-linq/types';

class TestDialect implements SqlDialect {
  public buildSelect(
    entityClass: new () => unknown,
    options: QueryOptions
  ): { query: string; parameters: SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass)!;
    let query = `SELECT ${options.distinct ? 'DISTINCT ' : ''}${
      options.select?.length ? options.select.join(', ') : '*'
    } FROM ${meta.tableName}`;
    const parameters: SqlParameter[] = [];
    if (options.where) {
      const whereClauses = Array.isArray(options.where) ? options.where : [options.where];
      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.map((w) => w.condition).join(' AND ');
        for (const w of whereClauses) parameters.push(...w.parameters);
      }
    }
    if (options.orderBy && options.orderBy.length) {
      query += ' ORDER BY ' + options.orderBy.map((o) => `${o.column} ${o.direction}`).join(', ');
    }
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      query += ` LIMIT ${options.limit}`;
      if (hasOffset) query += ` OFFSET ${options.offset}`;
    } else if (hasOffset) {
      query += ` LIMIT -1 OFFSET ${options.offset}`;
    }
    return { query, parameters };
  }
  public quoteIdentifier(identifier: string): string {
    return `\`${identifier}\``;
  }
  public buildInsert(
    _entity: Record<string, unknown>,
    _metadata: EntityMetadata
  ): { sql: string; parameters: SqlParameter[] } {
    return { sql: 'INSERT...', parameters: [] };
  }
  public buildUpdate(
    _entity: Record<string, unknown>,
    _metadata: EntityMetadata
  ): { sql: string; parameters: SqlParameter[] } {
    return { sql: 'UPDATE...', parameters: [] };
  }
  public buildDelete(
    _entity: Record<string, unknown>,
    _metadata: EntityMetadata
  ): { sql: string; parameters: SqlParameter[] } {
    return { sql: 'DELETE...', parameters: [] };
  }

  /** Batch INSERT — returns a special tag so TestProvider can simulate RETURNING *. */
  public buildBatchInsert(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult {
    const autoGenPks = metadata.columns
      .filter((c) => c.isGenerated && (metadata.primaryKeys ?? []).includes(c.propertyName))
      .map((c) => c.columnName);
    const payload = JSON.stringify({ table: metadata.tableName, entities, autoGenPks });
    return { sql: `BATCH_INSERT ${payload}`, parameters: [] };
  }

  /** Batch UPDATE — returns per-entity statements (MySQL-style). */
  public buildBatchUpdate(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult {
    const payload = JSON.stringify({ table: metadata.tableName, entities });
    return { statements: [{ sql: `BATCH_UPDATE ${payload}`, parameters: [] }] };
  }

  /** Batch DELETE — encodes PKs so TestProvider can remove rows. */
  public buildBatchDelete(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): SqlWithParams {
    const pks = metadata.primaryKeys ?? [];
    const pkValues = entities.map((e) => e[pks[0]]);
    const payload = JSON.stringify({ table: metadata.tableName, pkValues, pkCol: pks[0] });
    return { sql: `BATCH_DELETE ${payload}`, parameters: [] };
  }

  public buildBulkUpdate(ctx: BulkUpdateContext): SqlWithParams {
    const params: SqlParameter[] = [];
    const setClauses: string[] = [];
    for (const setter of ctx.setters) {
      if (setter.value.kind === 'literal') {
        setClauses.push(`\`${setter.columnName}\` = ?`);
        params.push(...setter.value.params);
      } else {
        setClauses.push(`\`${setter.columnName}\` = \`${setter.value.refColumnName}\``);
      }
    }
    let sql = `UPDATE \`${ctx.tableName}\` SET ${setClauses.join(', ')}`;
    if (ctx.where.length > 0) {
      const conditions = ctx.where.map((w) => w.condition).join(' AND ');
      for (const w of ctx.where) params.push(...w.parameters);
      sql += ` WHERE ${conditions}`;
    }
    return { sql, parameters: params };
  }

  public buildBulkDelete(ctx: BulkDeleteContext): SqlWithParams {
    const params: SqlParameter[] = [];
    let sql = `DELETE FROM \`${ctx.tableName}\``;
    if (ctx.where.length > 0) {
      const conditions = ctx.where.map((w) => w.condition).join(' AND ');
      for (const w of ctx.where) params.push(...w.parameters);
      sql += ` WHERE ${conditions}`;
    }
    return { sql, parameters: params };
  }

  readonly parameterLimit = 65535;
}

type TestProviderConfig = {
  file?: string;
  logger?: SqlLogger;
  middlewares?: OrmMiddleware[];
  softDelete?: SoftDeleteOptions;
  retryPolicy?: RetryPolicy;
  poolOptions?: ConnectionPoolOptions;
  healthCheck?: ConnectionHealthCheckOptions;
  circuit?: CircuitBreakerOptions;
};

export class TestProvider extends DatabaseProvider {
  public executionCount = 0;
  public nextResult: Array<Record<string, unknown>> | undefined;

  constructor(configOrConnectionString?: string | TestProviderConfig) {
    const config =
      typeof configOrConnectionString === 'string'
        ? { file: configOrConnectionString }
        : configOrConnectionString || { file: ':memory:' };

    super(
      config.file || ':memory:',
      config.logger,
      config.middlewares,
      config.softDelete,
      config.retryPolicy,
      config.poolOptions,
      config.healthCheck,
      config.circuit // circuitOptions
    );
    this.providerName = 'test';
  }

  private readonly data: Map<string, Array<Record<string, unknown>>> = new Map();
  private readonly seq: Map<string, number> = new Map();
  private readonly dialect = new TestDialect();

  public override async connect(): Promise<void> {
    this.isConnected = true;
  }

  public override async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  public async createTable(entityMetadata: EntityMetadata): Promise<void> {
    await this.beforeExecute(`CREATE TABLE ${entityMetadata.tableName}`, []);
    if (!this.data.has(entityMetadata.tableName)) {
      this.data.set(entityMetadata.tableName, []);
      this.seq.set(entityMetadata.tableName, 0);
    }
    await this.afterExecute(`CREATE TABLE ${entityMetadata.tableName}`, [], 0);
  }

  public getDialect(): SqlDialect {
    return this.dialect;
  }

  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const sql = `INSERT INTO ${meta.tableName}`;
    const startedAt = Date.now();
    this.logger?.queryStart?.({
      sql,
      params: [],
      traceId: this.currentTraceId,
      provider: this.providerName
    });
    await this.beforeExecute(sql, []);
    await this.ensureTable(meta);
    const table = this.data.get(meta.tableName)!;
    const rec: Record<string, unknown> = {};
    const entityRecord = entity as unknown as Record<string, unknown>;
    for (const col of meta.columns) {
      const val = entityRecord[col.propertyName];
      if (val !== undefined) rec[col.columnName] = val;
    }
    for (const [k, v] of Object.entries(entityRecord)) {
      if (rec[k] === undefined) rec[k] = v;
    }
    const pks = meta.primaryKeys || [];
    if (pks.length > 0) {
      const pk = pks[0];
      const pkCol = meta.columns.find((c) => c.propertyName === pk);
      if (
        pkCol?.isGenerated &&
        (rec[pkCol.columnName] === undefined || rec[pkCol.columnName] === null)
      ) {
        const next = this.seq.get(meta.tableName)! + 1;
        this.seq.set(meta.tableName, next);
        rec[pkCol.columnName] = next;
        entityRecord[pk] = next;
      }
    }
    table.push(rec);
    await this.afterExecute(sql, [], 1);
    this.logger?.queryEnd?.({
      sql,
      params: [],
      durationMs: Date.now() - startedAt,
      rows: 1,
      traceId: this.currentTraceId,
      provider: this.providerName
    });
    return entity;
  }

  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const sql = `UPDATE ${meta.tableName}`;
    const startedAt = Date.now();
    this.logger?.queryStart?.({
      sql,
      params: [],
      traceId: this.currentTraceId,
      provider: this.providerName
    });
    await this.beforeExecute(sql, []);
    const table = this.data.get(meta.tableName) || [];
    const pks = meta.primaryKeys || [];
    const pk = pks[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkName = pkCol?.columnName ?? pk;
    const entityRecord = entity as unknown as Record<string, unknown>;
    const idx = table.findIndex((r) => r[pkName] === entityRecord[pk]);
    const targetIdx = idx >= 0 ? idx : table.length > 0 ? table.length - 1 : -1;
    if (targetIdx >= 0) {
      const row = table[targetIdx];
      for (const col of meta.columns) {
        if (col.propertyName === pk) continue;
        const val = entityRecord[col.propertyName];
        if (val !== undefined) row[col.columnName] = val;
      }
    }
    await this.afterExecute(sql, [], 1);
    this.logger?.queryEnd?.({
      sql,
      params: [],
      durationMs: Date.now() - startedAt,
      rows: 1,
      traceId: this.currentTraceId,
      provider: this.providerName
    });
    return entity;
  }

  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const sql = `DELETE FROM ${meta.tableName}`;
    const startedAt = Date.now();
    this.logger?.queryStart?.({
      sql,
      params: [],
      traceId: this.currentTraceId,
      provider: this.providerName
    });
    await this.beforeExecute(sql, []);
    const table = this.data.get(meta.tableName) || [];
    const pks = meta.primaryKeys || [];
    const pk = pks[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkName = pkCol?.columnName ?? pk;
    const entityRecord = entity as unknown as Record<string, unknown>;
    const idx = table.findIndex((r) => r[pkName] === entityRecord[pk]);
    if (idx >= 0) {
      table.splice(idx, 1);
    }
    await this.afterExecute(sql, [], 1);
    this.logger?.queryEnd?.({
      sql,
      params: [],
      durationMs: Date.now() - startedAt,
      rows: 0,
      traceId: this.currentTraceId,
      provider: this.providerName
    });
  }

  public async findByPk<T extends object>(
    pkValue: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = this.data.get(meta.tableName) || [];
    const pks = meta.primaryKeys || [];
    const pk = pks[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkName = pkCol?.columnName ?? pk;
    const rec = table.find((r) => r[pkName] === pkValue);
    if (!rec) return null;
    const instance = new entityClass();
    for (const col of meta.columns) {
      (instance as Record<string, unknown>)[col.propertyName] = rec[col.columnName];
    }
    return instance;
  }

  public async findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    return this.findByPk(id, entityClass);
  }

  public async queryEntities<T extends object>(
    sql: string,
    params: readonly SqlParameter[],
    entityClass: new () => T
  ): Promise<T[]> {
    const rows = await this.doExecuteQuery<Record<string, unknown>>(sql, params);
    const meta = MetadataStorage.getEntity(entityClass);

    return rows.map((rec) => {
      const instance = new entityClass();
      if (meta) {
        for (const col of meta.columns) {
          (instance as Record<string, unknown>)[col.propertyName] = rec[col.columnName];
        }
      } else {
        Object.assign(instance, rec);
      }
      return instance;
    });
  }

  public async count(entityClass: Function): Promise<number> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`SELECT COUNT(*) FROM ${meta.tableName}`, []);
    const table = this.data.get(meta.tableName) || [];
    await this.afterExecute(`SELECT COUNT(*) FROM ${meta.tableName}`, [], 1);
    return table.length;
  }

  private async ensureTable(meta: EntityMetadata): Promise<void> {
    if (!this.data.has(meta.tableName)) {
      await this.createTable(meta);
    }
  }

  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`SELECT * FROM ${meta.tableName}`, []);
    const table = this.data.get(meta.tableName) || [];
    await this.afterExecute(`SELECT * FROM ${meta.tableName}`, [], table.length);
    return table.map((rec) => {
      const instance = new entityClass();
      for (const col of meta.columns) {
        (instance as Record<string, unknown>)[col.propertyName] = rec[col.columnName];
      }
      return instance;
    });
  }

  public async findWhere<T extends object>(
    entityClass: new () => T,
    _where: Record<string, unknown>
  ): Promise<T[]> {
    return this.findAll(entityClass); // Stub behavior
  }

  public async findWhereIn<T extends object>(
    entityClass: new () => T,
    _column: string,
    _values: unknown[]
  ): Promise<T[]> {
    return this.findAll(entityClass); // Stub behavior
  }

  public async doExecuteQuery<T>(sql: string, params: readonly SqlParameter[] = []): Promise<T[]> {
    this.executionCount++;
    if (this.nextResult) {
      return this.nextResult as unknown as T[];
    }

    // Handle BATCH_INSERT generated by TestDialect.buildBatchInsert
    if (sql.startsWith('BATCH_INSERT ')) {
      const payload = JSON.parse(sql.slice('BATCH_INSERT '.length)) as {
        table: string;
        entities: Record<string, unknown>[];
        autoGenPks?: string[];
      };
      const { table: tableName, entities, autoGenPks = ['id'] } = payload;
      if (!this.data.has(tableName)) this.data.set(tableName, []);
      const table = this.data.get(tableName)!;
      const returned: Record<string, unknown>[] = [];
      for (const entity of entities) {
        const rec: Record<string, unknown> = { ...entity };
        // Auto-assign sequential PK for each generated PK column that is missing/null
        for (const pkCol of autoGenPks) {
          if (rec[pkCol] == null) {
            const next = (this.seq.get(tableName) ?? 0) + 1;
            this.seq.set(tableName, next);
            rec[pkCol] = next;
          }
        }
        table.push(rec);
        returned.push({ ...rec });
      }
      return returned as unknown as T[];
    }

    // console.log(`[TestProvider] SQL: ${sql}`);

    // Parse FROM to find table
    const fromMatch = sql.match(/FROM\s+([`"']?\w+[`"']?)/i);
    // console.log(`[TestProvider] SQL: ${sql}, TableMatch: ${fromMatch ? fromMatch[1] : 'None'}`);
    if (!fromMatch) return [];

    const tableName = fromMatch[1].replace(/['"`]/g, '');
    let table = this.data.get(tableName) || [];
    // console.log(`[TestProvider] Table: ${tableName}, Rows: ${table.length}`);

    if (sql.includes('ORDER BY')) {
      const orderMatch = sql.match(/ORDER BY (\w+)(?: (ASC|DESC))?/);
      if (orderMatch) {
        const orderCol = orderMatch[1];
        const dir = orderMatch[2] || 'ASC';
        table = [...table].sort((a, b) => {
          const aVal = a[orderCol] as number | string;
          const bVal = b[orderCol] as number | string;
          if (aVal < bVal) return dir === 'ASC' ? -1 : 1;
          if (aVal > bVal) return dir === 'ASC' ? 1 : -1;
          return 0;
        });
      }
    }

    if (sql.includes('WHERE')) {
      const match = sql.match(/WHERE\s+(.*?)(\s+ORDER\s+BY|\s+LIMIT|\s*$)/i);
      if (match) {
        const wherePart = match[1];
        const conditions = wherePart.split(/\s+AND\s+/i).map((c) => c.trim());

        table = table.filter((rec) => {
          return conditions.every((cond) => {
            // Handle inequalities
            const operatorMatch = cond.match(/([<>=!]+)/);
            if (operatorMatch) {
              const op = operatorMatch[1];
              const parts = cond.split(op).map((x) => x.trim().replace(/['"`]/g, ''));
              const col = parts[0];
              let val: string | number = parts[1];

              if (val === '?') {
                return true; // Weak fallback, handled by paramMatches below
              }

              // Try parsing numbers
              if (!isNaN(Number(val))) val = Number(val);

              const rowVal = rec[col] as number | string | null;

              switch (op) {
                case '=':
                  return rowVal == val;
                case '!=':
                case '<>':
                  return rowVal != val;
                case '>':
                  return (rowVal as number) > (val as number);
                case '>=':
                  return (rowVal as number) >= (val as number);
                case '<':
                  return (rowVal as number) < (val as number);
                case '<=':
                  return (rowVal as number) <= (val as number);
              }
            }
            return true;
          });
        });

        // Better param handling for the specific "tenantId = ?" case in tests
        const paramMatches = [...sql.matchAll(/[`"']?(\w+)[`"']?\s*([<>=!]+)\s*\?/g)];
        if (paramMatches.length > 0 && params.length > 0) {
          table = table.filter((rec) => {
            let matchIndex = 0;
            return paramMatches.every((m) => {
              const col = m[1];
              const op = m[2];
              const val = params[matchIndex++] as number | string | null;
              const rowVal = rec[col] as number | string | null;
              switch (op) {
                case '=':
                  return rowVal == val;
                case '!=':
                case '<>':
                  return rowVal != val;
                case '>':
                  return val != null && (rowVal as number) > (val as number);
                case '>=':
                  return val != null && (rowVal as number) >= (val as number);
                case '<':
                  return val != null && (rowVal as number) < (val as number);
                case '<=':
                  return val != null && (rowVal as number) <= (val as number);
                default:
                  return true;
              }
            });
          });
        }
      }
    }

    if (sql.includes('LIMIT')) {
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
      const limit = limitMatch ? parseInt(limitMatch[1]) : table.length;
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
      table = table.slice(offset, offset + limit);
    }

    return table as unknown as T[];
  }

  public async doExecuteNonQuery(sql: string, _params: readonly SqlParameter[]): Promise<number> {
    // Handle BATCH_UPDATE generated by TestDialect.buildBatchUpdate
    if (sql.startsWith('BATCH_UPDATE ')) {
      const payload = JSON.parse(sql.slice('BATCH_UPDATE '.length)) as {
        table: string;
        entities: Record<string, unknown>[];
      };
      const { table: tableName, entities } = payload;
      const table = this.data.get(tableName) ?? [];
      let count = 0;
      for (const entity of entities) {
        const pkCol = Object.keys(entity).find((k) => k === 'id') ?? '';
        const pkVal = entity[pkCol];
        const idx = table.findIndex((r) => r[pkCol] === pkVal);
        if (idx >= 0) {
          table[idx] = { ...table[idx], ...entity };
          count++;
        }
      }
      return count;
    }

    // Handle BATCH_DELETE generated by TestDialect.buildBatchDelete
    if (sql.startsWith('BATCH_DELETE ')) {
      const payload = JSON.parse(sql.slice('BATCH_DELETE '.length)) as {
        table: string;
        pkValues: unknown[];
        pkCol: string;
      };
      const { table: tableName, pkValues, pkCol } = payload;
      const table = this.data.get(tableName) ?? [];
      const before = table.length;
      const filtered = table.filter((r) => !pkValues.includes(r[pkCol]));
      this.data.set(tableName, filtered);
      return before - filtered.length;
    }

    // Default: return 1 for any DML statement (UPDATE/DELETE) not handled above
    return 1;
  }

  public override async beginTransaction(): Promise<void> {}
  public override async commitTransaction(): Promise<void> {}
  public override async rollbackTransaction(): Promise<void> {}
  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}

  public async transaction<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }

  public async commit(): Promise<void> {}
  public async rollback(): Promise<void> {}

  public async executeRaw(_sql: string, _params: readonly SqlParameter[]): Promise<unknown[]> {
    return [];
  }
}
