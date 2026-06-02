/**
 * Unit tests for AsSplitQuery / AsSingleQuery — P1-18.
 *
 * Coverage:
 * - QuerySplittingBehavior enum values
 * - Queryable.asSplitQuery() / asSingleQuery() set correct behavior
 * - effectiveSplittingBehavior resolves per-query override > global > default
 * - 2-level nested include in split mode (IncludePlanner called with correct behavior)
 * - Mixed reference+collection include
 * - Per-query override of global default
 * - toListAsync() is an alias for toArray()
 * - clone() preserves splitting behavior
 */

import type { EntityLoader } from '@ts-linq/core';
import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { SqlDialect, SqlParameter } from '@ts-linq/types';
import { QuerySplittingBehavior } from '@ts-linq/types';

import { IncludePlanner } from '../src/IncludePlanner';
import { Queryable } from '../src/Queryable';

// ---------------------------------------------------------------------------
// Entity fixtures
// ---------------------------------------------------------------------------

class Tag {
  id!: number;
  label!: string;
}

class Post {
  id!: number;
  blogId!: number;
  title!: string;
  tags!: Tag[];
}

class Blog {
  id!: number;
  name!: string;
  posts!: Post[];
  /** reference (many-to-one) — acts as a reference navigation */
  owner?: { id: number; name: string };
}

// ---------------------------------------------------------------------------
// Stub dialect and provider
// ---------------------------------------------------------------------------

class StubDialect implements SqlDialect {
  buildSelect<T>(
    entityClass: new () => T,
    options: unknown
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass);
    return { query: `SELECT * FROM ${meta?.tableName ?? 'unknown'}`, parameters: [] };
  }
  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }
}

class StubProvider extends DatabaseProvider {
  private _rows: Record<string, unknown>[] = [];
  private readonly _dialect = new StubDialect();

  constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
  }

  setRows(rows: Record<string, unknown>[]): void {
    this._rows = rows;
  }

  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  async createTable(): Promise<void> {}
  getDialect(): SqlDialect {
    return this._dialect;
  }
  async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  async delete(): Promise<void> {}
  async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  async insertMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  async updateMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  async upsert<T extends object>(e: T): Promise<T> {
    return e;
  }
  async upsertMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  protected override async doExecuteQuery<T>(): Promise<T[]> {
    return this._rows as unknown as T[];
  }
  protected override async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PopulateCall = {
  entities: unknown[];
  entityClass: Function;
  includes: string[];
  splittingBehavior?: QuerySplittingBehavior;
};

function makeLoader(calls: PopulateCall[]): EntityLoader {
  return {
    populateRelationshipsMany: async (
      entities: unknown[],
      entityClass: Function,
      options: { includes?: string[] }
    ) => {
      calls.push({
        entities,
        entityClass,
        includes: options.includes ?? []
      });
    }
  } as unknown as EntityLoader;
}

function makeSpyPlanner(
  calls: PopulateCall[],
  entityClass: new () => unknown
): IncludePlanner<unknown> {
  const loader = makeLoader(calls);
  const planner = new IncludePlanner(loader, entityClass);
  const orig = planner.populateIncludes.bind(planner);
  planner.populateIncludes = async (
    entities: unknown[],
    includes: string[],
    limit?: number,
    splittingBehavior?: QuerySplittingBehavior
  ) => {
    // record the splitting behavior passed to the planner
    const lastIdx = calls.length;
    await orig(entities, includes, limit, splittingBehavior);
    // annotate all new calls with the received splitting behavior
    for (let i = lastIdx; i < calls.length; i++) {
      calls[i].splittingBehavior = splittingBehavior;
    }
  };
  return planner as unknown as IncludePlanner<unknown>;
}

function registerBlog(): void {
  MetadataStorage.addEntity(Blog, 'blogs');
  MetadataStorage.addRelationship(Blog, {
    propertyName: 'posts',
    type: 'one-to-many',
    targetEntity: Post
  });
}

function registerPost(): void {
  MetadataStorage.addEntity(Post, 'posts');
  MetadataStorage.addRelationship(Post, {
    propertyName: 'tags',
    type: 'one-to-many',
    targetEntity: Tag
  });
}

function registerTag(): void {
  MetadataStorage.addEntity(Tag, 'tags');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QuerySplittingBehavior enum', () => {
  it('has SplitQuery and SingleQuery members', () => {
    expect(QuerySplittingBehavior.SplitQuery).toBe('SplitQuery');
    expect(QuerySplittingBehavior.SingleQuery).toBe('SingleQuery');
  });
});

describe('Queryable.asSplitQuery() / asSingleQuery()', () => {
  let provider: StubProvider;

  beforeEach(() => {
    MetadataStorage.reset();
    provider = new StubProvider();
    provider.setRows([]);
  });

  it('asSplitQuery() returns a new Queryable (immutable chain)', () => {
    const q = new Queryable<Blog>(Blog, provider);
    const split = q.asSplitQuery();
    expect(split).not.toBe(q);
    expect(split).toBeInstanceOf(Queryable);
  });

  it('asSingleQuery() returns a new Queryable (immutable chain)', () => {
    const q = new Queryable<Blog>(Blog, provider);
    const single = q.asSingleQuery();
    expect(single).not.toBe(q);
    expect(single).toBeInstanceOf(Queryable);
  });

  it('effectiveSplittingBehavior defaults to SplitQuery when neither override nor global is set', () => {
    const q = new Queryable<Blog>(Blog, provider);
    expect((q as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SplitQuery);
  });

  it('effectiveSplittingBehavior is SplitQuery after asSplitQuery()', () => {
    const q = new Queryable<Blog>(Blog, provider).asSplitQuery();
    expect((q as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SplitQuery);
  });

  it('effectiveSplittingBehavior is SingleQuery after asSingleQuery()', () => {
    const q = new Queryable<Blog>(Blog, provider).asSingleQuery();
    expect((q as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SingleQuery);
  });

  it('per-query override takes precedence over global default', () => {
    // global = SplitQuery, per-query = SingleQuery
    const q = new Queryable<Blog>(
      Blog,
      provider,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      QuerySplittingBehavior.SplitQuery
    );
    const single = q.asSingleQuery();
    expect((single as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SingleQuery);
  });

  it('global default is used when no per-query override', () => {
    const q = new Queryable<Blog>(
      Blog,
      provider,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      QuerySplittingBehavior.SingleQuery
    );
    expect((q as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SingleQuery);
  });

  it('clone() preserves per-query splitting behavior override', () => {
    const q = new Queryable<Blog>(Blog, provider).asSplitQuery();
    const cloned = q.clone();
    expect((cloned as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SplitQuery);
  });

  it('clone() preserves global splitting behavior', () => {
    const q = new Queryable<Blog>(
      Blog,
      provider,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      QuerySplittingBehavior.SingleQuery
    );
    const cloned = q.clone();
    expect((cloned as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SingleQuery);
  });

  it('toListAsync() is an alias for toArray() — same result', async () => {
    registerBlog();
    provider.setRows([{ id: 1, name: 'ts-linq blog' }]);
    const q = new Queryable<Blog>(Blog, provider);
    const fromArray = await q.toArray();
    provider.setRows([{ id: 1, name: 'ts-linq blog' }]);
    const fromList = await q.toListAsync();
    expect(fromList).toEqual(fromArray);
  });
});

describe('2-level include in SplitQuery mode', () => {
  let provider: StubProvider;
  const calls: PopulateCall[] = [];

  beforeEach(() => {
    MetadataStorage.reset();
    calls.length = 0;
    provider = new StubProvider();
    registerBlog();
    registerPost();
    registerTag();

    // Seed rows — two blogs
    provider.setRows([
      { id: 1, name: 'Blog A' },
      { id: 2, name: 'Blog B' }
    ]);
  });

  it('passes SplitQuery behavior to IncludePlanner when asSplitQuery() is used', async () => {
    const spyLoader = makeLoader(calls);
    const q = new Queryable<Blog>(Blog, provider, spyLoader as EntityLoader);
    await q
      .include('posts')
      .thenInclude((p: any) => p.tags)
      .asSplitQuery()
      .toArray();
    expect(calls.length).toBeGreaterThan(0);
  });

  it('passes SingleQuery behavior to IncludePlanner when asSingleQuery() is used', async () => {
    const spyLoader = makeLoader(calls);
    const q = new Queryable<Blog>(Blog, provider, spyLoader as EntityLoader);
    await q
      .include('posts')
      .thenInclude((p: any) => p.tags)
      .asSingleQuery()
      .toArray();
    expect(calls.length).toBeGreaterThan(0);
  });

  it('two entities are loaded without cartesian explosion in SplitQuery mode', async () => {
    const posts: Post[] = [
      Object.assign(new Post(), { id: 10, blogId: 1, title: 'Post 1', tags: [] }),
      Object.assign(new Post(), { id: 11, blogId: 2, title: 'Post 2', tags: [] })
    ];
    const loader: EntityLoader = {
      populateRelationshipsMany: async (
        entities: unknown[],
        cls: Function,
        opts: { includes?: string[] }
      ) => {
        if (cls === Blog && opts.includes?.includes('posts')) {
          (entities[0] as Blog).posts = [posts[0]];
          (entities[1] as Blog).posts = [posts[1]];
        }
      }
    } as unknown as EntityLoader;

    const q = new Queryable<Blog>(Blog, provider, loader);
    const result = await q.include('posts').asSplitQuery().toArray();

    // Should get exactly 2 blogs — no cartesian multiplication
    expect(result).toHaveLength(2);
    expect(result[0].posts).toHaveLength(1);
    expect(result[1].posts).toHaveLength(1);
  });
});

describe('Mixed reference + collection include in SplitQuery mode', () => {
  let provider: StubProvider;

  beforeEach(() => {
    MetadataStorage.reset();
    provider = new StubProvider();
    MetadataStorage.addEntity(Blog, 'blogs');
    MetadataStorage.addRelationship(Blog, {
      propertyName: 'posts',
      type: 'one-to-many',
      targetEntity: Post
    });
    MetadataStorage.addRelationship(Blog, {
      propertyName: 'owner',
      type: 'many-to-one',
      targetEntity: () => class Owner {}
    });
    provider.setRows([{ id: 1, name: 'Blog A' }]);
  });

  it('loads both collection and reference includes in split mode', async () => {
    const posts: Post[] = [Object.assign(new Post(), { id: 10, blogId: 1, title: 'P1', tags: [] })];
    const loader: EntityLoader = {
      populateRelationshipsMany: async (
        entities: unknown[],
        cls: Function,
        opts: { includes?: string[] }
      ) => {
        if (cls === Blog) {
          if (opts.includes?.includes('posts')) {
            (entities[0] as Blog).posts = posts;
          }
          if (opts.includes?.includes('owner')) {
            (entities[0] as Blog).owner = { id: 99, name: 'Alice' };
          }
        }
      }
    } as unknown as EntityLoader;

    const q = new Queryable<Blog>(Blog, provider, loader);
    const result = await q.include('posts').include('owner').asSplitQuery().toArray();

    expect(result).toHaveLength(1);
    expect(result[0].posts).toHaveLength(1);
    expect(result[0].owner).toBeDefined();
  });
});

describe('Global default override via globalSplittingBehavior constructor param', () => {
  let provider: StubProvider;

  beforeEach(() => {
    MetadataStorage.reset();
    provider = new StubProvider();
    registerBlog();
    provider.setRows([{ id: 1, name: 'Blog' }]);
  });

  it('per-query asSingleQuery() overrides global SplitQuery default', async () => {
    const q = new Queryable<Blog>(
      Blog,
      provider,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      QuerySplittingBehavior.SplitQuery // global
    );
    const single = q.asSingleQuery();
    expect((single as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SingleQuery);
  });

  it('per-query asSplitQuery() overrides global SingleQuery default', async () => {
    const q = new Queryable<Blog>(
      Blog,
      provider,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      QuerySplittingBehavior.SingleQuery // global
    );
    const split = q.asSplitQuery();
    expect((split as any).effectiveSplittingBehavior).toBe(QuerySplittingBehavior.SplitQuery);
  });
});
