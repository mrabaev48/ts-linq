import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type {
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  EntityMetadata,
  OrmMiddleware,
  QueryOptions,
  RetryPolicy,
  SoftDeleteOptions,
  SqlDialect,
  SqlLogger,
  SqlParameter
} from '@ts-linq/types';
import type { CircuitBreakerOptions } from '@ts-linq/core';

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
    const config = typeof configOrConnectionString === 'string' 
        ? { file: configOrConnectionString } 
        : (configOrConnectionString || { file: ':memory:' });

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
    await this.afterExecute(`INSERT INTO ${meta.tableName}`, [], 1);
    return entity;
  }

  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`UPDATE ${meta.tableName}`, []);
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
    await this.afterExecute(`UPDATE ${meta.tableName}`, [], 1);
    return entity;
  }

  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    await this.beforeExecute(`DELETE FROM ${meta.tableName}`, []);
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
    await this.afterExecute(`DELETE FROM ${meta.tableName}`, [], 1);
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
      instance[col.propertyName] = rec[col.columnName];
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
                  instance[col.propertyName] = rec[col.columnName];
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
        instance[col.propertyName] = rec[col.columnName];
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

  public async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    this.executionCount++;
    if (this.nextResult) {
        return this.nextResult as unknown as T[];
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
          const aVal = a[orderCol];
          const bVal = b[orderCol];
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
            const conditions = wherePart.split(/\s+AND\s+/i).map(c => c.trim());
            
            table = table.filter(rec => {
                return conditions.every(cond => {
                    // Handle inequalities
                    const operatorMatch = cond.match(/([<>=!]+)/);
                    if (operatorMatch) {
                        const op = operatorMatch[1];
                        const parts = cond.split(op).map(x => x.trim().replace(/['"`]/g, ''));
                        const col = parts[0];
                        let val: string | number = parts[1];
                        
                        if (val === '?') {
                             return true; // Weak fallback, handled by paramMatches below
                        }
                        
                        // Try parsing numbers
                        if (!isNaN(Number(val))) val = Number(val);

                        const rowVal = rec[col];
                        
                        switch (op) {
                            case '=': return rowVal == val;
                            case '!=': 
                            case '<>': return rowVal != val;
                            case '>': return rowVal > val;
                            case '>=': return rowVal >= val;
                            case '<': return rowVal < val;
                            case '<=': return rowVal <= val;
                        }
                    }
                    return true;
                });
            });

            // Better param handling for the specific "tenantId = ?" case in tests
            const paramMatches = [...sql.matchAll(/[`"']?(\w+)[`"']?\s*([<>=!]+)\s*\?/g)];
            if (paramMatches.length > 0 && params.length > 0) {
                 table = table.filter(rec => {
                     let matchIndex = 0;
                     return paramMatches.every(m => {
                         const col = m[1];
                         const op = m[2];
                         const val = params[matchIndex++];
                         
                         const rowVal = rec[col];
                         switch (op) {
                            case '=': return rowVal == val;
                            case '!=': 
                            case '<>': return rowVal != val;
                            case '>': return rowVal > val;
                            case '>=': return rowVal >= val;
                            case '<': return rowVal < val;
                            case '<=': return rowVal <= val;
                            default: return true;
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

  public async doExecuteNonQuery(_sql: string, _params: readonly SqlParameter[]): Promise<number> {
    return 0;
  }
  
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  
  public async transaction<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }
  
  public async commit(): Promise<void> {}
  public async rollback(): Promise<void> {}
  
  public async executeRaw(_sql: string, _params: readonly SqlParameter[]): Promise<unknown[]> {
      return [];
  }
}
