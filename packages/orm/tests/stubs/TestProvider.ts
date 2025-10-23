import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata, SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/types';

class TestDialect implements SqlDialect {
  public buildSelect(
    entityClass: new () => unknown,
    options: QueryOptions
  ): { query: string; parameters: SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass as unknown as Function)!;
    let query = `SELECT ${options.distinct ? 'DISTINCT ' : ''}${
      options.select?.length ? (options.select as string[]).join(', ') : '*'
    } FROM ${meta.tableName}`;
    const parameters: SqlParameter[] = [];
    if (options.where && options.where.length) {
      query += ' WHERE ' + options.where.map((w) => w.condition).join(' AND ');
      for (const w of options.where) parameters.push(...w.parameters);
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

export class TestProvider extends DatabaseProvider {
  constructor(connectionString: string) {
    super(connectionString, undefined, undefined, undefined, undefined);
    this.providerName = 'sqlite';
  }

  private readonly data: Map<string, any[]> = new Map();
  private readonly seq: Map<string, number> = new Map();
  private readonly dialect = new TestDialect();

  public async connect(): Promise<void> {
    this.isConnected = true;
  }

  public async disconnect(): Promise<void> {
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
    await this.beforeExecute(`INSERT INTO ${meta.tableName}`, []);
    await this.ensureTable(meta);
    const table = this.data.get(meta.tableName)!;
    const rec: any = {};
    for (const col of meta.columns) {
      const val = (entity as any)[col.propertyName];
      if (val !== undefined) rec[col.columnName] = val;
    }
    for (const [k, v] of Object.entries(entity as any)) {
      if (rec[k] === undefined) rec[k] = v;
    }
    if (meta.primaryKeys.length > 0) {
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
    const pk = meta.primaryKeys[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkName = pkCol?.columnName ?? pk;
    const idx = table.findIndex((r) => r[pkName] === (entity as any)[pk]);
    const targetIdx = idx >= 0 ? idx : table.length > 0 ? table.length - 1 : -1;
    if (targetIdx >= 0) {
      const row = table[targetIdx];
      for (const col of meta.columns) {
        if (col.propertyName === pk) continue;
        const val = (entity as any)[col.propertyName];
        if (val !== undefined) row[col.columnName] = val;
      }
    }
    await this.afterExecute(`UPDATE ${meta.tableName}`, [], 1);
    return entity;
  }

  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`DELETE FROM ${meta.tableName}`, []);
    const table = this.data.get(meta.tableName) || [];
    const pk = meta.primaryKeys[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkName = pkCol?.columnName ?? pk;
    const idx = table.findIndex((r) => r[pkName] === (entity as any)[pk]);
    if (idx >= 0) {
      table.splice(idx, 1);
    }
    await this.afterExecute(`DELETE FROM ${meta.tableName}`, [], 1);
  }

  public async findByPk<T extends object>(
    pkValue: any,
    entityClass: Function
  ): Promise<T | null> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = this.data.get(meta.tableName) || [];
    const pk = meta.primaryKeys[0];
    const pkCol = meta.columns.find((c) => c.propertyName === pk);
    const pkName = pkCol?.columnName ?? pk;
    const rec = table.find((r) => r[pkName] === pkValue);
    if (!rec) return null;
    const instance = new (entityClass as any)();
    for (const col of meta.columns) {
      instance[col.propertyName] = rec[col.columnName];
    }
    return instance;
  }

  public async findById<T extends object>(
    id: any,
    entityClass: Function
  ): Promise<T | null> {
    return this.findByPk(id, entityClass);
  }

  public async queryEntities<T extends object>(
    sql: string,
    params: any[],
    entityClass: Function
  ): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    let table = this.data.get(meta.tableName) || [];

    if (sql.includes('ORDER BY')) {
      const orderMatch = sql.match(/ORDER BY (\w+)/);
      if (orderMatch) {
        const orderCol = orderMatch[1];
        table = [...table].sort((a, b) => {
          const aVal = a[orderCol];
          const bVal = b[orderCol];
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        });
      }
    }

    if (sql.includes('LIMIT')) {
      const limitMatch = sql.match(/LIMIT (\d+)/);
      const offsetMatch = sql.match(/OFFSET (\d+)/);
      const limit = limitMatch ? parseInt(limitMatch[1]) : table.length;
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
      table = table.slice(offset, offset + limit);
    }

    return table.map((rec) => {
      const instance = new (entityClass as any)();
      for (const col of meta.columns) {
        instance[col.propertyName] = rec[col.columnName];
      }
      return instance;
    });
  }

  public async count(entityClass: Function): Promise<number> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = this.data.get(meta.tableName) || [];
    return table.length;
  }

  private async ensureTable(meta: EntityMetadata): Promise<void> {
    if (!this.data.has(meta.tableName)) {
      await this.createTable(meta);
    }
  }
}
