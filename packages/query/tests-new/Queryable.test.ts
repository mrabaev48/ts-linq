import { DatabaseProvider, QueryTrackingBehavior } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import type { GlobalFilter, SqlDialect, SqlParameter } from '@ts-linq/types';
import { QuerySplittingBehavior } from '@ts-linq/types';

import { InMemoryCountCache } from '../src/CountCache';
import { Queryable } from '../src/Queryable';

class User {
  id!: number;
  name!: string;
}

class Post {
  id!: number;
  userId!: number;
  title!: string;
}

class TestDialect implements SqlDialect {
  public buildSelect<T>(
    entityClass: new () => T,
    options: unknown
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass) || { tableName: entityClass.name };
    const opts = options as { limit?: number; offset?: number; select?: string[] } | undefined;
    const limit = typeof opts?.limit === 'number' ? opts.limit : undefined;
    const offset = typeof opts?.offset === 'number' ? opts.offset : 0;
    const marker = limit !== undefined ? ` /*LIMIT=${limit},OFFSET=${offset}*/` : '';
    const selectClause = opts?.select?.join(', ') ?? '*';
    return { query: `SELECT ${selectClause} FROM ${meta.tableName}${marker}`, parameters: [] };
  }
  public quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}

class TestProvider extends DatabaseProvider {
  private rows: Record<string, unknown>[] = [];
  private countValue: number = 0;
  private readonly dialect = new TestDialect();
  public setRows(rows: Record<string, unknown>[]): void {
    this.rows = rows;
  }
  public setCount(n: number): void {
    this.countValue = n;
  }
  // Abstracts
  public override async connect(): Promise<void> {}
  public override async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return this.dialect;
  }
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
  protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
    if (/COUNT\(\*\)\s+as\s+count/i.test(sql)) {
      return [{ count: this.countValue }] as unknown as T[];
    }
    const m = /\/\*LIMIT=(\d+),OFFSET=(\d+)\*\//.exec(sql);
    if (m) {
      const limit = parseInt(m[1], 10);
      const offset = parseInt(m[2], 10);
      return this.rows.slice(offset, offset + limit) as unknown as T[];
    }
    return this.rows as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
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
  public constructor() {
    // providerName label is used for cache keys/metrics
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'test';
  }
}

function registerUserMetadata(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'users');
  MetadataStorage.addColumn(User, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true
  });
  MetadataStorage.addPrimaryKey(User, 'id');
  MetadataStorage.addColumn(User, {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT'
  });
}

describe('Queryable (tests-new)', () => {
  beforeEach(() => {
    registerUserMetadata();
  });

  test('toArray() возвращает сущности и маппит поля по метаданным', async () => {
    const provider = new TestProvider();
    provider.setRows([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]);
    const q = new Queryable(User, QueryContext.fromProvider(provider));
    const items = await q.toArray();
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(expect.objectContaining({ id: 1, name: 'Alice' }));
  });

  test('where() и orderBy()/skip()/take() не ломают исполнение', async () => {
    const provider = new TestProvider();
    provider.setRows([{ id: 3, name: 'Carol' }]);
    const q = new Queryable(User, QueryContext.fromProvider(provider))
      .whereCompiled({
        ast: {
          type: 'binary',
          left: { type: 'property', path: ['id'] },
          operator: '>',
          right: { type: 'literal', value: 1 }
        },
        parameters: []
      })
      .orderBy('id')
      .skip(0)
      .take(10);
    const res = await q.toArray();
    expect(res[0].id).toBe(3);
  });

  test('count() использует кэш при enableCountCache', async () => {
    const provider = new TestProvider();
    provider.setCount(42);
    const q = new Queryable(
      User,
      QueryContext.fromProvider(provider, {
        performance: {
          enableCountCache: true,
          countCacheTtlMs: 10_000,
          countCache: new InMemoryCountCache(10_000)
        }
      })
    ).whereCompiled({
      ast: {
        type: 'binary',
        left: { type: 'property', path: ['id'] },
        operator: '>',
        right: { type: 'literal', value: 0 }
      },
      parameters: []
    });
    const n1 = await q.count();
    expect(n1).toBe(42);
    // Изменим провайдер, но второй вызов должен прийти из кэша
    provider.setCount(7);
    const n2 = await q.count();
    expect(n2).toBe(42);
  });

  test('first()/firstOrDefault()/any() работают поверх провайдера', async () => {
    const provider = new TestProvider();
    provider.setRows([{ id: 10, name: 'D' }]);
    const q = new Queryable(User, QueryContext.fromProvider(provider)).orderBy('id');
    const first = await q.first();
    expect(first.id).toBe(10);
    const any = await q.any();
    expect(any).toBe(true);
    // Пустой результат для firstOrDefault()
    provider.setRows([]);
    const firstOrDefault = await new Queryable(User, QueryContext.fromProvider(provider))
      .whereCompiled({
        ast: {
          type: 'binary',
          left: { type: 'property', path: ['id'] },
          operator: '===',
          right: { type: 'literal', value: -1 }
        },
        parameters: []
      })
      .firstOrDefault();
    expect(firstOrDefault).toBeNull();
  });

  test('where() compiles lambda to SQL predicate via transformer', () => {
    const provider = new TestProvider();
    const q = new Queryable(User, QueryContext.fromProvider(provider));
    // The compile-time transformer rewrites where(lambda) → whereCompiled(ast).
    // After transformation, the call should succeed and return a Queryable.
    expect(() => q.where((u) => u.id > 0)).not.toThrow();
  });

  test('select() compiles lambda to SQL projection via transformer', () => {
    const provider = new TestProvider();
    const q = new Queryable(User, QueryContext.fromProvider(provider));
    // The compile-time transformer rewrites select(lambda) → selectCompiled(ast).
    // After transformation, the call should succeed and return a Queryable.
    expect(() => q.select((u) => u.name)).not.toThrow();
  });

  // innerJoin() and leftJoin() (deprecated predicate overloads) were removed in ISSUE-003.
  // Use innerJoinOn(leftKey, rightKey) for type-safe joins instead.

  describe('innerJoinOn / leftJoinOn', () => {
    function registerPostMetadata(): void {
      MetadataStorage.addEntity(Post, 'posts');
      MetadataStorage.addColumn(Post, {
        propertyName: 'id',
        columnName: 'post_id',
        type: 'INTEGER',
        primaryKey: true
      });
      MetadataStorage.addColumn(Post, {
        propertyName: 'userId',
        columnName: 'user_id',
        type: 'INTEGER'
      });
      MetadataStorage.addColumn(Post, {
        propertyName: 'title',
        columnName: 'title',
        type: 'TEXT'
      });
    }

    beforeEach(() => {
      registerUserMetadata();
      registerPostMetadata();
    });

    it('innerJoinOn() adds INNER JOIN with correct ON clause using column name mapping', () => {
      const provider = new TestProvider();
      const q = new Queryable(User, QueryContext.fromProvider(provider));
      const joined = q.innerJoinOn(Post, 'id', 'userId');
      const model = (
        joined as unknown as {
          _model: {
            joins: Array<{ type: string; table: string; onColumns: unknown; alias?: string }>;
          };
        }
      )._model;
      expect(model.joins).toHaveLength(1);
      expect(model.joins[0].type).toBe('INNER');
      expect(model.joins[0].table).toBe('posts');
      expect(model.joins[0].onColumns).toEqual([
        { left: { table: 'users', column: 'id' }, right: { table: 'posts', column: 'user_id' } }
      ]);
      expect(model.joins[0].alias).toBeUndefined();
    });

    it('leftJoinOn() adds LEFT JOIN with correct ON clause using column name mapping', () => {
      const provider = new TestProvider();
      const q = new Queryable(User, QueryContext.fromProvider(provider));
      const joined = q.leftJoinOn(Post, 'id', 'userId');
      const model = (
        joined as unknown as {
          _model: {
            joins: Array<{ type: string; table: string; onColumns: unknown; alias?: string }>;
          };
        }
      )._model;
      expect(model.joins).toHaveLength(1);
      expect(model.joins[0].type).toBe('LEFT');
      expect(model.joins[0].table).toBe('posts');
      expect(model.joins[0].onColumns).toEqual([
        { left: { table: 'users', column: 'id' }, right: { table: 'posts', column: 'user_id' } }
      ]);
    });

    it('innerJoinOn() respects optional alias', () => {
      const provider = new TestProvider();
      const q = new Queryable(User, QueryContext.fromProvider(provider));
      const joined = q.innerJoinOn(Post, 'id', 'userId', 'p');
      const model = (
        joined as unknown as {
          _model: { joins: Array<{ type: string; table: string; on: string; alias?: string }> };
        }
      )._model;
      expect(model.joins[0].alias).toBe('p');
    });

    it('innerJoinOn() falls back to property name when column metadata is missing', () => {
      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addColumn(User, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
      MetadataStorage.addColumn(User, { propertyName: 'name', columnName: 'name', type: 'TEXT' });
      // Register Post without column metadata to test fallback
      MetadataStorage.addEntity(Post, 'posts');
      MetadataStorage.addColumn(Post, {
        propertyName: 'userId',
        columnName: 'userId',
        type: 'INTEGER'
      });
      MetadataStorage.addColumn(Post, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });

      const provider = new TestProvider();
      const q = new Queryable(User, QueryContext.fromProvider(provider));
      const joined = q.innerJoinOn(Post, 'id', 'userId');
      const model = (joined as unknown as { _model: { joins: Array<{ onColumns: unknown }> } })
        ._model;
      expect(model.joins[0].onColumns).toEqual([
        { left: { table: 'users', column: 'id' }, right: { table: 'posts', column: 'userId' } }
      ]);
    });

    it('multiple joinOn() calls accumulate joins', () => {
      const provider = new TestProvider();
      const q = new Queryable(User, QueryContext.fromProvider(provider));
      const joined = q.innerJoinOn(Post, 'id', 'userId').leftJoinOn(Post, 'id', 'userId', 'p2');
      const model = (joined as unknown as { _model: { joins: Array<unknown> } })._model;
      expect(model.joins).toHaveLength(2);
    });

    it('throws when entity metadata is not registered', () => {
      MetadataStorage.getInstance().clear();
      const provider = new TestProvider();
      const q = new Queryable(User, QueryContext.fromProvider(provider));
      expect(() => q.innerJoinOn(Post, 'id', 'userId')).toThrow(
        'ts-linq: entity metadata not found for join'
      );
    });
  });

  describe('QueryContext value object', () => {
    it('with() returns a new context with one field changed and others preserved', () => {
      const provider = new TestProvider();
      const base = new QueryContext({
        provider,
        trackingMode: QueryTrackingBehavior.TrackAll,
        globalSplittingBehavior: QuerySplittingBehavior.SplitQuery
      });

      const derived = base.with({ trackingMode: QueryTrackingBehavior.NoTracking });

      // New instance, original untouched (immutability).
      expect(derived).not.toBe(base);
      expect(base.trackingMode).toBe(QueryTrackingBehavior.TrackAll);
      // The overridden field changed…
      expect(derived.trackingMode).toBe(QueryTrackingBehavior.NoTracking);
      // …all other fields preserved (by reference where applicable).
      expect(derived.provider).toBe(provider);
      expect(derived.globalSplittingBehavior).toBe(QuerySplittingBehavior.SplitQuery);
      expect(derived.visitorFactory).toBe(base.visitorFactory);
    });

    it('with() can explicitly clear a field via undefined', () => {
      const base = QueryContext.fromProvider(new TestProvider(), {
        globalSplittingBehavior: QuerySplittingBehavior.SingleQuery
      });
      const cleared = base.with({ globalSplittingBehavior: undefined });
      expect(cleared.globalSplittingBehavior).toBeUndefined();
      expect(base.globalSplittingBehavior).toBe(QuerySplittingBehavior.SingleQuery);
    });
  });

  describe('selectCompiled projection carries the full context (regression)', () => {
    it('preserves global filters and tracking mode across a projection', () => {
      const provider = new TestProvider();
      const globalFilters: GlobalFilter[] = [{ filterName: 'tenant' }];
      const context = new QueryContext({
        provider,
        globalFilters,
        trackingMode: QueryTrackingBehavior.NoTracking
      });
      const source = new Queryable(User, context);

      const projected = source.selectCompiled<{ id: number }>({ fields: ['id'] });

      // Before the fix these six config fields were silently dropped on projection.
      const inspect = projected as unknown as {
        _globalFilters?: GlobalFilter[];
        _trackingMode: QueryTrackingBehavior;
      };
      expect(inspect._globalFilters).toBe(globalFilters);
      expect(inspect._trackingMode).toBe(QueryTrackingBehavior.NoTracking);
    });

    it('preserves a per-chain asNoTracking() override applied before the projection', () => {
      const provider = new TestProvider();
      const source = new Queryable(User, QueryContext.fromProvider(provider)).asNoTracking();

      const projected = source.selectCompiled<{ id: number }>({ fields: ['id'] });

      expect((projected as unknown as { _trackingMode: QueryTrackingBehavior })._trackingMode).toBe(
        QueryTrackingBehavior.NoTracking
      );
    });
  });

  describe('fork safety / uniform immutability (task-2)', () => {
    const makeQ = (): Queryable<User> =>
      new Queryable(User, QueryContext.fromProvider(new TestProvider()));

    type ModelView = {
      _model: {
        limit?: number;
        offset?: number;
        orderBy?: Array<{ column: string; direction: string }>;
        where?: Array<{ condition: string }>;
        groupBy?: { columns: string[] };
        unions?: Array<unknown>;
      };
    };
    const model = (q: unknown): ModelView['_model'] => (q as unknown as ModelView)._model;

    it('every chainable operator returns a new reference (never `this`)', () => {
      const q = makeQ();
      expect(q.take(1)).not.toBe(q);
      expect(q.skip(1)).not.toBe(q);
      expect(q.distinct()).not.toBe(q);
      expect(q.whereIn('id', [1, 2])).not.toBe(q);
      expect(q.groupBy('id')).not.toBe(q);
      expect(q.union(makeQ())).not.toBe(q);
      expect(q.unionAll(makeQ())).not.toBe(q);
      expect(q.orderBy('id')).not.toBe(q);
      expect(q.orderByDescending('id')).not.toBe(q);
      expect(q.ignoreQueryFilters()).not.toBe(q);
      expect(q.withAbort(new AbortController().signal)).not.toBe(q);
    });

    it('take(): forking a base does not corrupt either branch (canonical hazard)', () => {
      const base = makeQ().orderBy('id');
      const a = base.take(10);
      const b = base.take(20);
      expect(model(a).limit).toBe(10);
      expect(model(b).limit).toBe(20);
      expect(model(base).limit).toBeUndefined();
    });

    it('skip(): forks keep independent offsets', () => {
      const base = makeQ();
      const a = base.skip(5);
      const b = base.skip(15);
      expect(model(a).offset).toBe(5);
      expect(model(b).offset).toBe(15);
      expect(model(base).offset).toBeUndefined();
    });

    it('whereIn(): predicates do not leak between forks', () => {
      const base = makeQ();
      const a = base.whereIn('id', [1]);
      const b = base.whereIn('id', [2, 3]);
      expect(model(a).where).toHaveLength(1);
      expect(model(b).where).toHaveLength(1);
      expect(model(base).where).toBeUndefined();
    });

    it('groupBy(): grouping does not leak onto the base', () => {
      const base = makeQ();
      const a = base.groupBy('id');
      expect(model(a).groupBy).toEqual({ columns: ['id'] });
      expect(model(base).groupBy).toBeUndefined();
    });

    it('orderBy(): sort keys do not leak between forks', () => {
      const base = makeQ();
      const a = base.orderBy('id');
      const b = base.orderBy('name');
      expect(model(a).orderBy).toEqual([{ column: 'id', direction: 'ASC' }]);
      expect(model(b).orderBy).toEqual([{ column: 'name', direction: 'ASC' }]);
      expect(model(base).orderBy).toBeUndefined();
    });

    it('union(): set operations do not leak onto the base', () => {
      const base = makeQ();
      const a = base.union(makeQ());
      expect(model(a).unions).toHaveLength(1);
      expect(model(base).unions).toBeUndefined();
    });

    it('orderBy().thenBy() chains on a fresh instance without mutating the base', () => {
      const base = makeQ().orderBy('id');
      const chained = base.thenBy('name');
      expect(model(chained).orderBy).toEqual([
        { column: 'id', direction: 'ASC' },
        { column: 'name', direction: 'ASC' }
      ]);
      // base kept only its single sort key — thenBy did not mutate it
      expect(model(base).orderBy).toEqual([{ column: 'id', direction: 'ASC' }]);
      // chained instance is still an OrderedQueryable (thenByDescending available)
      expect(typeof (chained as { thenByDescending?: unknown }).thenByDescending).toBe('function');
    });

    it('withAbort(): immutable, and the signal propagates through later operators', () => {
      const controller = new AbortController();
      const base = makeQ();
      const aborted = base.withAbort(controller.signal);
      expect(aborted).not.toBe(base);
      // clone() must carry _abortSignal forward through a subsequent operator
      const next = aborted.take(5);
      expect((next as unknown as { _abortSignal?: AbortSignal })._abortSignal).toBe(
        controller.signal
      );
      expect((base as unknown as { _abortSignal?: AbortSignal })._abortSignal).toBeUndefined();
    });
  });
});
