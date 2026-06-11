import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import type { EntityAttacher, SqlDialect, SqlParameter } from '@ts-linq/types';

import { Queryable } from '../../src/Queryable';

// ── Entity fixtures ───────────────────────────────────────────────────────────

class StreamUser {
  id!: number;
  name!: string;
}

// ── Minimal SQL dialect ───────────────────────────────────────────────────────

class StreamTestDialect implements SqlDialect {
  public buildSelect<T>(
    entityClass: new () => T,
    options: unknown
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass) || { tableName: entityClass.name };
    return { query: `SELECT * FROM ${meta.tableName}`, parameters: [] };
  }
  public quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }
}

// ── Test provider ─────────────────────────────────────────────────────────────

class StreamTestProvider extends DatabaseProvider {
  private rows: Record<string, unknown>[] = [];
  public executedSqls: string[] = [];
  private readonly dialect = new StreamTestDialect();

  public setRows(rows: Record<string, unknown>[]): void {
    this.rows = rows;
  }

  public getDialect(): SqlDialect {
    return this.dialect;
  }

  protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
    this.executedSqls.push(sql);

    // Parse LIMIT/OFFSET appended by streamRows → buildChunkSql
    const limitOffsetMatch = /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i.exec(sql);
    if (limitOffsetMatch) {
      const limit = parseInt(limitOffsetMatch[1], 10);
      const offset = parseInt(limitOffsetMatch[2], 10);
      return this.rows.slice(offset, offset + limit) as unknown as T[];
    }

    // COUNT query (used by count() terminal operator)
    if (/COUNT\(\*\)\s+as\s+count/i.test(sql)) {
      return [{ count: this.rows.length }] as unknown as T[];
    }

    return this.rows as unknown as T[];
  }

  protected async doExecuteNonQuery(): Promise<number> {
    return 1;
  }

  // Required abstract implementations
  public override async connect(): Promise<void> {}
  public override async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  public override async beginTransaction(): Promise<void> {}
  public override async commitTransaction(): Promise<void> {}
  public override async rollbackTransaction(): Promise<void> {}
  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}

  public constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'test';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupMetadata(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(StreamUser, 'stream_users');
  MetadataStorage.addColumn(StreamUser, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true,
    nullable: false,
    unique: false
  });
  MetadataStorage.addColumn(StreamUser, {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT',
    primaryKey: false,
    nullable: false,
    unique: false
  });
}

function makeRows(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `user-${i + 1}` }));
}

function makeQueryable(provider: StreamTestProvider): Queryable<StreamUser> {
  return new Queryable<StreamUser>(StreamUser, QueryContext.fromProvider(provider));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('asAsyncEnumerable / forEachAsync / toDictionaryAsync', () => {
  let provider: StreamTestProvider;

  beforeEach(() => {
    setupMetadata();
    provider = new StreamTestProvider();
  });

  // ── asAsyncEnumerable ─────────────────────────────────────────────────────

  describe('asAsyncEnumerable', () => {
    it('collects all rows across multiple chunks', async () => {
      const rowCount = 2500;
      provider.setRows(makeRows(rowCount));
      const queryable = makeQueryable(provider);

      const collected: StreamUser[] = [];
      for await (const entity of queryable.asAsyncEnumerable()) {
        collected.push(entity);
      }

      expect(collected).toHaveLength(rowCount);
      expect(collected[0].id).toBe(1);
      expect(collected[rowCount - 1].id).toBe(rowCount);
      // 2500 rows at chunk size 1000: 3 chunks (1000 + 1000 + 500)
      expect(provider.executedSqls).toHaveLength(3);
    });

    it('yields entities with correct field mapping', async () => {
      provider.setRows([{ id: 42, name: 'Alice' }]);
      const queryable = makeQueryable(provider);

      const entities: StreamUser[] = [];
      for await (const e of queryable.asAsyncEnumerable()) {
        entities.push(e);
      }

      expect(entities).toHaveLength(1);
      expect(entities[0].id).toBe(42);
      expect(entities[0].name).toBe('Alice');
    });

    it('returns nothing when result set is empty', async () => {
      provider.setRows([]);
      const queryable = makeQueryable(provider);

      const entities: StreamUser[] = [];
      for await (const e of queryable.asAsyncEnumerable()) {
        entities.push(e);
      }

      expect(entities).toHaveLength(0);
    });

    it('respects .take(n) — streams at most n rows', async () => {
      provider.setRows(makeRows(500));
      const queryable = makeQueryable(provider).take(5);

      const collected: StreamUser[] = [];
      for await (const e of queryable.asAsyncEnumerable()) {
        collected.push(e);
      }

      expect(collected).toHaveLength(5);
      expect(collected[0].id).toBe(1);
      expect(collected[4].id).toBe(5);
    });

    it('respects .skip(n) — starts at offset n', async () => {
      provider.setRows(makeRows(20));
      const queryable = makeQueryable(provider).skip(10);

      const collected: StreamUser[] = [];
      for await (const e of queryable.asAsyncEnumerable()) {
        collected.push(e);
      }

      expect(collected).toHaveLength(10);
      expect(collected[0].id).toBe(11);
    });

    it('respects .skip(m).take(n) combination', async () => {
      provider.setRows(makeRows(50));
      const queryable = makeQueryable(provider).skip(5).take(3);

      const collected: StreamUser[] = [];
      for await (const e of queryable.asAsyncEnumerable()) {
        collected.push(e);
      }

      expect(collected).toHaveLength(3);
      expect(collected[0].id).toBe(6);
    });

    it('cancels streaming when AbortSignal is aborted between chunks', async () => {
      provider.setRows(makeRows(3000));
      const queryable = makeQueryable(provider);
      const controller = new AbortController();

      let count = 0;
      let threw = false;
      try {
        for await (const _ of queryable.asAsyncEnumerable(controller.signal)) {
          count++;
          if (count === 1500) controller.abort();
        }
      } catch (err) {
        threw = true;
        expect((err as Error).message).toBe('Operation aborted');
      }

      expect(threw).toBe(true);
      expect(count).toBeLessThanOrEqual(1500 + 1); // at most one more row after abort
    });

    it('throws immediately when AbortSignal is already aborted', async () => {
      provider.setRows(makeRows(10));
      const queryable = makeQueryable(provider);
      const signal = AbortSignal.abort();

      let threw = false;
      try {
        for await (const _ of queryable.asAsyncEnumerable(signal)) {
          // should never reach here
        }
      } catch (err) {
        threw = true;
        expect((err as Error).message).toBe('Operation aborted');
      }

      expect(threw).toBe(true);
    });

    it('issues one SQL per chunk with correct LIMIT/OFFSET', async () => {
      provider.setRows(makeRows(2100));
      const queryable = makeQueryable(provider);

      for await (const _ of queryable.asAsyncEnumerable()) {
        /* drain */
      }

      // 3 chunks: 1000 + 1000 + 100
      expect(provider.executedSqls).toHaveLength(3);
      expect(provider.executedSqls[0]).toMatch(/LIMIT 1000 OFFSET 0/i);
      expect(provider.executedSqls[1]).toMatch(/LIMIT 1000 OFFSET 1000/i);
      expect(provider.executedSqls[2]).toMatch(/LIMIT 1000 OFFSET 2000/i);
    });

    it('calls EntityAttacher.attach per entity in TrackAll mode', async () => {
      provider.setRows([
        { id: 1, name: 'Bob' },
        { id: 2, name: 'Eve' }
      ]);

      const attached: object[] = [];
      const mockAttacher: EntityAttacher = {
        attach: (entity: object) => {
          attached.push(entity);
        }
      };

      const queryable = new Queryable<StreamUser>(
        StreamUser,
        QueryContext.fromProvider(provider, { entityAttacher: mockAttacher })
      );

      for await (const _ of queryable.asAsyncEnumerable()) {
        /* drain */
      }

      expect(attached).toHaveLength(2);
    });
  });

  // ── forEachAsync ─────────────────────────────────────────────────────────

  describe('forEachAsync', () => {
    it('calls action for each entity', async () => {
      provider.setRows(makeRows(5));
      const queryable = makeQueryable(provider);

      const ids: number[] = [];
      await queryable.forEachAsync((e) => {
        ids.push(e.id);
      });

      expect(ids).toEqual([1, 2, 3, 4, 5]);
    });

    it('awaits async action before proceeding to next entity', async () => {
      provider.setRows([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ]);
      const queryable = makeQueryable(provider);

      const order: number[] = [];
      await queryable.forEachAsync(async (e) => {
        await Promise.resolve();
        order.push(e.id);
      });

      expect(order).toEqual([1, 2]);
    });

    it('resolves immediately on empty result', async () => {
      provider.setRows([]);
      const queryable = makeQueryable(provider);

      let called = false;
      await queryable.forEachAsync(() => {
        called = true;
      });

      expect(called).toBe(false);
    });

    it('cancels via AbortSignal', async () => {
      provider.setRows(makeRows(3000));
      const queryable = makeQueryable(provider);
      const controller = new AbortController();

      let count = 0;
      let threw = false;
      try {
        await queryable.forEachAsync((e) => {
          count++;
          if (count === 1500) controller.abort();
        }, controller.signal);
      } catch (err) {
        threw = true;
        expect((err as Error).message).toBe('Operation aborted');
      }

      expect(threw).toBe(true);
    });
  });

  // ── toDictionaryAsync ─────────────────────────────────────────────────────

  describe('toDictionaryAsync', () => {
    it('builds a Map keyed by keySelector (key only)', async () => {
      provider.setRows([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]);
      const queryable = makeQueryable(provider);

      const map = await queryable.toDictionaryAsync((u) => u.id);

      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(2);
      expect(map.get(1)?.name).toBe('Alice');
      expect(map.get(2)?.name).toBe('Bob');
    });

    it('builds a Map with projected values (key + element selector)', async () => {
      provider.setRows([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]);
      const queryable = makeQueryable(provider);

      const map = await queryable.toDictionaryAsync(
        (u) => u.id,
        (u) => u.name
      );

      expect(map.size).toBe(2);
      expect(map.get(1)).toBe('Alice');
      expect(map.get(2)).toBe('Bob');
    });

    it('returns an empty Map when result set is empty', async () => {
      provider.setRows([]);
      const queryable = makeQueryable(provider);

      const map = await queryable.toDictionaryAsync((u) => u.id);
      expect(map.size).toBe(0);
    });

    it('throws on duplicate keys — mirrors EF Core error message', async () => {
      provider.setRows([
        { id: 1, name: 'Alice' },
        { id: 1, name: 'Duplicate' }
      ]);
      const queryable = makeQueryable(provider);

      await expect(queryable.toDictionaryAsync((u) => u.id)).rejects.toThrow(
        'An item with the same key has already been added. Key: 1'
      );
    });

    it('cancels via pre-aborted signal passed as second argument (no element selector)', async () => {
      provider.setRows(makeRows(10));
      const queryable = makeQueryable(provider);
      const signal = AbortSignal.abort();

      await expect(queryable.toDictionaryAsync((u) => u.id, signal)).rejects.toThrow(
        'Operation aborted'
      );
    });

    it('cancels via pre-aborted signal passed as third argument (with element selector)', async () => {
      provider.setRows(makeRows(10));
      const queryable = makeQueryable(provider);
      const signal = AbortSignal.abort();

      await expect(
        queryable.toDictionaryAsync(
          (u) => u.id,
          (u) => u.name,
          signal
        )
      ).rejects.toThrow('Operation aborted');
    });
  });

  // ── MssqlProvider.buildChunkSql ───────────────────────────────────────────

  describe('MssqlProvider.buildChunkSql', () => {
    it('appends OFFSET/FETCH and injects ORDER BY when not present', async () => {
      const { MssqlProvider } = await import('@ts-linq/provider-mssql');
      // Access protected method via cast
      const provider = new MssqlProvider({
        server: 'localhost',
        user: 'sa',
        password: 'pass',
        database: 'db'
      });
      const buildChunkSql = (
        provider as unknown as {
          buildChunkSql(baseSql: string, limit: number, offset: number): string;
        }
      ).buildChunkSql.bind(provider);

      const result = buildChunkSql('SELECT * FROM users WHERE active = @p1', 100, 500);
      expect(result).toContain('ORDER BY (SELECT NULL)');
      expect(result).toContain('OFFSET 500 ROWS FETCH NEXT 100 ROWS ONLY');
    });

    it('does not double ORDER BY when already present in base SQL', async () => {
      const { MssqlProvider } = await import('@ts-linq/provider-mssql');
      const provider = new MssqlProvider({
        server: 'localhost',
        user: 'sa',
        password: 'pass',
        database: 'db'
      });
      const buildChunkSql = (
        provider as unknown as {
          buildChunkSql(baseSql: string, limit: number, offset: number): string;
        }
      ).buildChunkSql.bind(provider);

      const result = buildChunkSql('SELECT * FROM users ORDER BY id', 50, 0);
      expect(result.match(/ORDER BY/gi)?.length).toBe(1);
      expect(result).toContain('OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY');
    });
  });
});
