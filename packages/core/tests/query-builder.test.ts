import { QueryBuilder } from '../src/query/QueryBuilder';
import { DatabaseProvider } from '../src/DatabaseProvider';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { QueryOptions, SqlParameter } from '../src/types';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { QueryOptions } from '../src/types';

// Define test entity inside function to ensure decorators execute properly
function createQueryTestEntity() {
  @Entity()
  class QueryTestEntity {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;

    @Column()
    age!: number;
  }
  return QueryTestEntity;
}

describe('QueryBuilder (SQL generation only)', () => {
  let provider: DatabaseProvider;
  let queryBuilder: QueryBuilder;
  let QueryTestEntity: ReturnType<typeof createQueryTestEntity>;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    // Create test entity
    QueryTestEntity = createQueryTestEntity();

    // In-memory stub provider: only SELECT used
    provider = new (class extends DatabaseProvider {
      private data: any[] = [];
      private seq: number = 0;
      public async connect(): Promise<void> {}
      public async disconnect(): Promise<void> {}
      public async createTable(): Promise<void> {}
      public getDialect(): any {
        return {};
      }
      public async insert<T extends object>(e: T): Promise<T> {
        const rec = { ...(e as any) };
        if (rec.id === undefined || rec.id === null) rec.id = ++this.seq;
        this.data.push(rec);
        return e;
      }
      public async update<T extends object>(e: T): Promise<T> {
        return e;
      }
      public async delete<T extends object>(): Promise<void> {}
      public async findById<T extends object>(): Promise<T | null> {
        return null;
      }
      public async findAll<T extends object>(): Promise<T[]> {
        return this.data.slice() as T[];
      }
      public async findWhere<T extends object>(): Promise<T[]> {
        return this.data.slice() as T[];
      }
      public async findWhereIn<T extends object>(): Promise<T[]> {
        return this.data.slice() as T[];
      }
      protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
        const limit = /LIMIT\s+(\d+)/i.exec(sql)?.[1];
        const offset = /OFFSET\s+(\d+)/i.exec(sql)?.[1];
        let rows = this.data.slice();
        const orderMatch = /ORDER BY\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(ASC|DESC)/i.exec(sql);
        if (orderMatch) {
          const col = orderMatch[1];
          const dir = orderMatch[2].toUpperCase();
          rows.sort((a, b) => (a[col] === b[col] ? 0 : a[col] < b[col] ? -1 : 1));
          if (dir === 'DESC') rows.reverse();
        }
        if (offset) rows = rows.slice(Number(offset));
        if (limit) rows = rows.slice(0, Number(limit));
        return rows as unknown as T[];
      }
      protected async doExecuteNonQuery(sql: string): Promise<number> {
        if (/^\s*DELETE\s+FROM\s+QueryTestEntity/i.test(sql)) {
          const n = this.data.length;
          this.data = [];
          return n;
        }
        return 0;
      }
      public async beginTransaction(): Promise<void> {}
      public async commitTransaction(): Promise<void> {}
      public async rollbackTransaction(): Promise<void> {}
    })('');

    // Seed data
    for (let i = 1; i <= 10; i++) {
      const entity = new QueryTestEntity();
      entity.name = `Name ${i}`;
      entity.age = 20 + i;
      await provider.insert(entity, QueryTestEntity);
    }

    const mockDialect: SqlDialect = {
      buildSelect: (ctor: new () => unknown, opts: QueryOptions) => {
        const meta = MetadataStorage.getEntity(ctor as unknown as Function)!;
        let query = `SELECT ${opts.distinct ? 'DISTINCT ' : ''}${
          opts.select?.length ? (opts.select as string[]).join(', ') : '*'
        }`;
        query += ` FROM ${meta.tableName}`;
        const parameters: SqlParameter[] = [];
        if (opts.where && opts.where.length) {
          query += ' WHERE ' + opts.where.map((w) => w.condition).join(' AND ');
          for (const w of opts.where) parameters.push(...w.parameters);
        }
        if (opts.orderBy && opts.orderBy.length) {
          query += ' ORDER BY ' + opts.orderBy.map((o) => `${o.column} ${o.direction}`).join(', ');
        }
        const hasLimit = opts.limit !== undefined && opts.limit !== null;
        const hasOffset = opts.offset !== undefined && opts.offset !== null;
        if (hasLimit) {
          query += ` LIMIT ${opts.limit}`;
          if (hasOffset) query += ` OFFSET ${opts.offset}`;
        } else if (hasOffset) {
          query += ` LIMIT -1 OFFSET ${opts.offset}`;
        }
        return { query, parameters } as const;
      }
    } as unknown as SqlDialect;
    queryBuilder = new QueryBuilder(mockDialect);
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  describe('basic operations', () => {
    it('should return all entities with toArray', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {});
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results).toHaveLength(10);
    });

    it('should count entities', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {});
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      const count = results.length;
      expect(count).toBe(10);
    });

    it('should check if any entities exist', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {});
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results.length > 0).toBe(true);
    });
  });

  describe('take and skip', () => {
    it('should limit results with take', async () => {
      const opts: QueryOptions = { limit: 5 };
      const sql = queryBuilder.generateSql(QueryTestEntity, opts);
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results).toHaveLength(5);
    });

    it('should skip results', async () => {
      const opts: QueryOptions = { offset: 5 };
      const sql = queryBuilder.generateSql(QueryTestEntity, opts);
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results).toHaveLength(5);
    });

    it('should combine take and skip for pagination', async () => {
      const opts: QueryOptions = { offset: 3, limit: 2 };
      const sql = queryBuilder.generateSql(QueryTestEntity, opts);
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results).toHaveLength(2);
    });
  });

  describe('ordering', () => {
    it('should order by ascending', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {
        orderBy: [{ column: 'age', direction: 'ASC' }]
      });
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect((results[0] as { age: number }).age).toBeLessThan((results[1] as { age: number }).age);
    });

    it('should order by descending', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {
        orderBy: [{ column: 'age', direction: 'DESC' }]
      });
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect((results[0] as { age: number }).age).toBeGreaterThan(
        (results[1] as { age: number }).age
      );
    });
  });

  describe('first operations (via SQL generation)', () => {
    it('should get first row using LIMIT 1', async () => {
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {
        orderBy: [{ column: 'id', direction: 'ASC' }],
        limit: 1
      });
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows).toHaveLength(1);
      expect((rows[0] as { id: number }).id).toBe(1);
    });

    it('should return empty when no results with LIMIT 1', async () => {
      await provider.executeNonQuery('DELETE FROM QueryTestEntity');
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, { limit: 1 });
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows).toHaveLength(0);
    });
  });

  describe('single-like checks (via SQL generation)', () => {
    it('should get one row when only one exists', async () => {
      await provider.executeNonQuery('DELETE FROM QueryTestEntity');
      const entity = new QueryTestEntity();
      entity.name = 'Single';
      entity.age = 25;
      await provider.insert(entity, QueryTestEntity);
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows).toHaveLength(1);
      expect((rows[0] as { name: string }).name).toBe('Single');
    });

    it('should return zero rows when none exist', async () => {
      await provider.executeNonQuery('DELETE FROM QueryTestEntity');
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows).toHaveLength(0);
    });

    it('should return multiple rows when multiple exist', async () => {
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows.length).toBeGreaterThan(1);
    });
  });

  describe('distinct', () => {
    it('should generate DISTINCT select', async () => {
      const { query } = queryBuilder.generateSql(QueryTestEntity, { distinct: true });
      expect(query.toUpperCase()).toContain('SELECT DISTINCT');
    });
  });
});
