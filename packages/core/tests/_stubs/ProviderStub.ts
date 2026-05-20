/* eslint-disable complexity */
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata, QueryOptions, SqlDialect, SqlParameter } from '@ts-linq/types';

import { DatabaseProvider } from '../../src/DatabaseProvider';

class TestDialect implements SqlDialect {
  public quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  public buildSelect(
    entityClass: new () => unknown,
    options: QueryOptions
  ): { query: string; parameters: SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass)!;
    let query = `SELECT ${options.distinct ? 'DISTINCT ' : ''}${
      options.select?.length ? options.select.join(', ') : '*'
    } FROM ${meta.tableName}`;
    const parameters: SqlParameter[] = [];
    const whereArray = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    if (whereArray.length) {
      query += ' WHERE ' + whereArray.map((w) => w.condition).join(' AND ');
      for (const w of whereArray) parameters.push(...w.parameters);
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
}

export class ProviderStub extends DatabaseProvider {
  constructor(
    connectionString: string,
    logger?: any,
    middlewares?: any,
    softDelete?: any,
    retryPolicy?: any
  ) {
    super(connectionString, logger, middlewares, softDelete, retryPolicy);
    this.providerName = 'test';
  }
  private readonly data: Map<string, any[]> = new Map();
  private readonly seq: Map<string, number> = new Map();
  private readonly dialect = new TestDialect();
  private txBackup?: { data: Map<string, any[]>; seq: Map<string, number> };

  // Override template methods directly (interceptors not needed in stubs)
  public override async connect(): Promise<void> {
    this.isConnected = true;
  }
  public override async disconnect(): Promise<void> {
    this.isConnected = false;
  }
  // Required abstract implementations (never called — template methods are overridden above)
  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
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
    await this.beforeExecute(`INSERT INTO ${meta.tableName}`, []);
    await this.ensureTable(meta);
    const table = this.data.get(meta.tableName)!;
    const rec: any = {};
    for (const col of meta.columns) {
      const val = (entity as any)[col.propertyName];
      if (val !== undefined) rec[col.columnName] = val;
    }
    // Fallback: also copy plain enumerable props by property name
    for (const [k, v] of Object.entries(entity as any)) {
      if (rec[k] === undefined) rec[k] = v;
    }
    // auto-increment primary key
    if (meta.primaryKeys && meta.primaryKeys.length > 0) {
      const pk = meta.primaryKeys[0];
      const pkCol = meta.columns.find((c) => c.propertyName === pk);
      if (
        pkCol?.isGenerated &&
        (rec[pkCol.columnName] === undefined || rec[pkCol.columnName] === null)
      ) {
        const next = this.seq.get(meta.tableName)! + 1;
        this.seq.set(meta.tableName, next);
        rec[pkCol.columnName] = next;
        (entity as any)[pk] = next;
      }
    }
    table.push(rec);
    await this.afterExecute(`INSERT INTO ${meta.tableName}`, [], 1);
    return entity;
  }

  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`UPDATE ${meta.tableName}`, []);
    const table = this.data.get(meta.tableName) || [];
    const pk = meta.primaryKeys?.[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkProp = pk ?? pkCol?.propertyName ?? 'id';
    const pkName = pkCol?.columnName ?? pkProp;
    const idx = table.findIndex((r) => r[pkName] === (entity as any)[pkProp]);
    const targetIdx = idx >= 0 ? idx : table.length > 0 ? table.length - 1 : -1;
    if (targetIdx >= 0) {
      const row = table[targetIdx];
      for (const col of meta.columns) {
        if (col.propertyName === pkProp) continue;
        const val = (entity as any)[col.propertyName];
        if (val !== undefined) row[col.columnName] = val;
      }
      // audit updatedAt
      const updatedAtCol = meta.columns.find((c) => c.columnName === 'updatedAt');
      if (updatedAtCol) row['updatedAt'] = new Date();
      // Fallback: copy other enumerable props
      for (const [k, v] of Object.entries(entity as any)) {
        if (row[k] === undefined && k !== pk) row[k] = v;
      }
      this.data.set(meta.tableName, table);
      await this.afterExecute(`UPDATE ${meta.tableName}`, [], 1);
      return entity;
    }
    await this.afterExecute(`UPDATE ${meta.tableName}`, [], 0);
    throw new Error('No rows were updated.');
  }

  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`DELETE FROM ${meta.tableName}`, []);
    const table = this.data.get(meta.tableName) || [];
    const pk = meta.primaryKeys?.[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkProp = pk ?? pkCol?.propertyName ?? 'id';
    const pkName = pkCol?.columnName ?? pkProp;
    const idx = table.findIndex((r) => r[pkName] === (entity as any)[pkProp]);
    if (idx >= 0) {
      const sd = this.softDelete;
      if (sd?.enabled && sd.column) {
        // soft delete: mark flag and timestamp
        const row = table[idx];
        row[sd.column] = true;
        if ((sd as any).deletedAtColumn) row[(sd as any).deletedAtColumn] = new Date();
        await this.afterExecute(`UPDATE ${meta.tableName} /* soft-delete */`, [], 1);
      } else {
        table.splice(idx, 1);
        await this.afterExecute(`DELETE FROM ${meta.tableName}`, [], 1);
      }
      return;
    }
    await this.afterExecute(`DELETE FROM ${meta.tableName}`, [], 0);
    throw new Error('No rows were deleted.');
  }

  public async findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`SELECT * FROM ${meta.tableName} WHERE id = ?`, [id as SqlParameter]);
    const table = this.data.get(meta.tableName) || [];
    const pk = meta.primaryKeys?.[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkProp = pk ?? pkCol?.propertyName ?? 'id';
    const pkName = pkCol?.columnName ?? pkProp;
    let row = table.find((r) => r[pkName] === id);
    if (this.softDelete?.enabled && this.softDelete.column && row && row[this.softDelete.column]) {
      row = undefined;
    }
    const ent = row ? this.materialize(entityClass, row) : null;
    await this.afterExecute(
      `SELECT * FROM ${meta.tableName} WHERE id = ?`,
      [id as SqlParameter],
      ent ? 1 : 0
    );
    return ent;
  }

  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`SELECT * FROM ${meta.tableName}`, []);
    const table = (this.data.get(meta.tableName) || []).slice();
    const pk = meta.primaryKeys?.[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkProp = pk ?? pkCol?.propertyName ?? 'id';
    const pkName = pkCol?.columnName ?? pkProp;
    // apply soft-delete filter if configured
    let rows = table;
    if (this.softDelete?.enabled && this.softDelete.column) {
      const col = this.softDelete.column;
      rows = rows.filter((r) => !r[col]);
    }
    rows.sort((a, b) => (a[pkName] ?? 0) - (b[pkName] ?? 0));
    const res = rows.map((r) => this.materialize(entityClass, r));
    await this.afterExecute(`SELECT * FROM ${meta.tableName}`, [], res.length);
    return res;
  }

  public async findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const params: SqlParameter[] = Object.values(conditions) as SqlParameter[];
    await this.beforeExecute(`SELECT * FROM ${meta.tableName} WHERE ...`, params);
    const table = (this.data.get(meta.tableName) || []).slice();
    const entries = Object.entries(conditions);
    let rows = table;
    if (this.softDelete?.enabled && this.softDelete.column) {
      const col = this.softDelete.column;
      rows = rows.filter((r) => !r[col]);
    }
    const res = rows
      .filter((r) => entries.every(([k, v]) => r[k] === v))
      .map((r) => this.materialize(entityClass, r));
    await this.afterExecute(`SELECT * FROM ${meta.tableName} WHERE ...`, params, res.length);
    return res;
  }

  public async findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(
      `SELECT * FROM ${meta.tableName} WHERE ${column} IN (?)`,
      values as SqlParameter[]
    );
    const table = this.data.get(meta.tableName) || [];
    const colName = column;
    const set = new Set(values);
    const res = table
      .filter((r) => set.has(r[colName]))
      .map((r) => this.materialize(entityClass, r));
    await this.afterExecute(
      `SELECT * FROM ${meta.tableName} WHERE ${column} IN (?)`,
      values as SqlParameter[],
      res.length
    );
    return res;
  }

  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    const startedAt = Date.now();
    if (!this.currentTraceId) this.currentTraceId = Math.random().toString(36).slice(2);
    this.loggerRef?.queryStart?.({ sql, params, provider: this.providerLabel });
    // Handle UNION / UNION ALL by splitting and executing parts, then merging
    const unionMatch = sql.toUpperCase().includes('UNION');
    if (unionMatch) {
      const parts = sql.replace(/\s+/g, ' ').split(/\s+UNION\s+ALL\s+|\s+UNION\s+/i);
      const isUnionAll = /UNION\s+ALL/i.test(sql);
      let combined: any[] = [];
      let offset = 0;
      for (const part of parts) {
        const phCount = (part.match(/\?/g) || []).length;
        const slice = params.slice(offset, offset + phCount);
        offset += phCount;
        const rows = (await this.doExecuteQuery<T>(part, slice)) as unknown as any[];
        if (isUnionAll) {
          combined = combined.concat(rows);
        } else {
          const seen = new Set(combined.map((r) => JSON.stringify(r)));
          for (const r of rows) {
            const key = JSON.stringify(r);
            if (!seen.has(key)) {
              combined.push(r);
              seen.add(key);
            }
          }
        }
      }
      const durationMs = Date.now() - startedAt;
      this.loggerRef?.queryEnd?.({
        sql,
        params,
        durationMs,
        rows: combined.length,
        provider: this.providerLabel
      });
      return combined;
    }
    // Very small SQL subset: SELECT * FROM <table> [WHERE <col> = ?] [ORDER BY <col> ASC|DESC] [LIMIT N [OFFSET M]]
    const mFrom = /FROM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
    if (!mFrom) return [];
    const tableName = mFrom[1];
    let rows = (this.data.get(tableName) || []).slice();
    if (this.softDelete?.enabled && this.softDelete.column) {
      // Always hide soft-deleted rows for unit-test simplicity
      const col = this.softDelete.column;
      rows = rows.filter((r) => !r[col]);
    }

    const whereEq = /WHERE\s+([A-Za-z_"\[\]]+)\s*=\s*\?/i.exec(sql);
    if (whereEq) {
      const col = whereEq[1].replace(/^["\[]|["\]]$/g, '');
      const val = params[0];
      rows = rows.filter((r) => r[col] === val);
    } else {
      // WHERE <col> = <number|boolean>
      const whereEqLit = /WHERE\s+([A-Za-z_"\[\]]+)\s*=\s*(\d+|true|false)/i.exec(sql);
      if (whereEqLit) {
        const col = whereEqLit[1].replace(/^["\[]|["\]]$/g, '');
        const lit = whereEqLit[2];
        const val = /true|false/i.test(lit) ? /true/i.test(lit) : Number(lit);
        rows = rows.filter((r) => r[col] === val);
      }
      const whereGt = /WHERE\s+([A-Za-z_][A-Za-z0-9_]*)\s*>\s*\?/i.exec(sql);
      if (whereGt) {
        const col = whereGt[1];
        const val = params[0] as unknown as number;
        rows = rows.filter((r) => (r[col] as number) > val);
      }
      const inMatch = /WHERE\s+([A-Za-z_][A-Za-z0-9_]*)\s+IN\s*\(([^)]+)\)/i.exec(sql);
      if (inMatch) {
        const col = inMatch[1];
        // Support IN with parameters or simple subquery: IN (SELECT col FROM Other)
        if (/^\s*SELECT\s+/i.test(inMatch[2])) {
          const sub = inMatch[2];
          const mSub = /SELECT\s+([A-Za-z_][A-Za-z0-9_]*)\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(
            sub
          );
          if (mSub) {
            const subCol = mSub[1];
            const subTable = mSub[2];
            const subRows = (this.data.get(subTable) || []).slice();
            const set = new Set(subRows.map((r) => r[subCol]));
            rows = rows.filter((r) => set.has(r[col]));
          }
        } else {
          const set = new Set(params);
          rows = rows.filter((r) => set.has(r[col]));
        }
      }
    }
    const orderMatch = /ORDER\s+BY\s+([A-Za-z_][A-Za-z0-9_]*)\s+(ASC|DESC)/i.exec(sql);
    if (orderMatch) {
      const col = orderMatch[1];
      const dir = orderMatch[2].toUpperCase();
      rows.sort((a, b) => (a[col] === b[col] ? 0 : a[col] < b[col] ? -1 : 1));
      if (dir === 'DESC') rows.reverse();
    }
    const mLimit = /LIMIT\s+(-?\d+)/i.exec(sql);
    const mOffset = /OFFSET\s+(\d+)/i.exec(sql);
    if (mOffset) rows = rows.slice(Number(mOffset[1]));
    if (mLimit) {
      const n = Number(mLimit[1]);
      if (n >= 0) rows = rows.slice(0, n);
    }
    // COUNT(*) support
    const isCount = /SELECT\s+COUNT\(\*\)\s+AS\s+count/i.test(sql);
    const result = isCount
      ? ([{ count: rows.length }] as unknown as T[])
      : (rows as unknown as T[]);
    const durationMs = Date.now() - startedAt;
    this.loggerRef?.queryEnd?.({
      sql,
      params,
      durationMs,
      rows: (result as unknown[]).length,
      provider: this.providerLabel
    });
    return result;
  }

  protected async doExecuteNonQuery(
    sql: string,
    _params: readonly SqlParameter[] = []
  ): Promise<number> {
    const startedAt = Date.now();
    if (!this.currentTraceId) this.currentTraceId = Math.random().toString(36).slice(2);
    this.loggerRef?.queryStart?.({ sql, params: _params, provider: this.providerLabel });
    const del = /^\s*DELETE\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
    if (del) {
      const tableName = del[1];
      const n = (this.data.get(tableName) || []).length;
      this.data.set(tableName, []);
      this.seq.set(tableName, 0);
      const durationMs = Date.now() - startedAt;
      this.loggerRef?.queryEnd?.({
        sql,
        params: _params,
        durationMs,
        rows: n,
        provider: this.providerLabel
      });
      return n;
    }
    const durationMs = Date.now() - startedAt;
    this.loggerRef?.queryEnd?.({
      sql,
      params: _params,
      durationMs,
      rows: 0,
      provider: this.providerLabel
    });
    return 0;
  }

  // Override template methods directly so test snapshots work without interceptor overhead
  public override async beginTransaction(): Promise<void> {
    // snapshot
    this.currentTraceId = Math.random().toString(36).slice(2);
    const dataCopy = new Map<string, any[]>();
    for (const [k, v] of this.data.entries())
      dataCopy.set(
        k,
        v.map((x) => ({ ...x }))
      );
    const seqCopy = new Map<string, number>();
    for (const [k, v] of this.seq.entries()) seqCopy.set(k, v);
    this.txBackup = { data: dataCopy, seq: seqCopy };
  }
  public override async commitTransaction(): Promise<void> {
    this.txBackup = undefined;
    this.currentTraceId = undefined;
  }
  public override async rollbackTransaction(): Promise<void> {
    if (this.txBackup) {
      this.data.clear();
      for (const [k, v] of this.txBackup.data.entries())
        this.data.set(
          k,
          v.map((x) => ({ ...x }))
        );
      this.seq.clear();
      for (const [k, v] of this.txBackup.seq.entries()) this.seq.set(k, v);
      this.txBackup = undefined;
    }
    this.currentTraceId = undefined;
  }
  // Required abstract implementations (never called — template methods are overridden above)
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}

  private async ensureTable(meta: EntityMetadata): Promise<void> {
    if (!this.data.has(meta.tableName)) await this.createTable(meta);
  }

  private materialize<T extends object>(ctor: new () => T, row: any): T {
    const entity = new ctor();
    const meta = MetadataStorage.getEntity(ctor);
    if (meta) {
      for (const c of meta.columns) {
        const v = row[c.columnName];
        if (v !== undefined) (entity as any)[c.propertyName] = v;
      }
      // Fallback: copy any remaining fields if not set by metadata
      for (const [k, v] of Object.entries(row)) {
        if ((entity as any)[k] === undefined) (entity as any)[k] = v;
      }
      // notify middleware about materialization
      void this.notifyEntityMaterialized(entity, meta);
    } else {
      Object.assign(entity as object, row as object);
    }
    return entity;
  }
}
