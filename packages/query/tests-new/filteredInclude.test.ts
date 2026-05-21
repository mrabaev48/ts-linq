/**
 * Unit tests — Filtered Include (P1-19).
 *
 * Covers:
 * - IncludeSubquery API: where, orderBy, orderByDescending, thenBy, thenByDescending, skip, take
 * - Forbidden operators: select, groupBy, join throw at runtime
 * - isFiltered flag
 * - applyFilter in-memory semantics
 * - Queryable.include() overload detection (simple vs filtered)
 * - _filteredIncludes stored and propagated through clone()
 * - thenInclude after filtered include correctly appends nested path
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { EntityLoader } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';

import { IncludeResolutionError } from '../src/errors';
import { IncludeSubquery } from '../src/include/IncludeSubquery';
import { IncludePlanner } from '../src/IncludePlanner';
import { Queryable } from '../src/Queryable';

// ── Entity fixtures ───────────────────────────────────────────────────────────

class Tag {
  id!: number;
  label!: string;
  postId!: number;
}

class Post {
  id!: number;
  title!: string;
  isPublished!: boolean;
  publishedAt!: Date;
  blogId!: number;
  tags!: Tag[];
}

class Blog {
  id!: number;
  name!: string;
  posts!: Post[];
}

// ── Metadata registration ─────────────────────────────────────────────────────

function registerAll(): void {
  MetadataStorage.addEntity(Blog, 'blogs');
  MetadataStorage.addPrimaryKey(Blog, 'id');
  MetadataStorage.addRelationship(Blog, {
    propertyName: 'posts',
    type: 'one-to-many',
    targetEntity: Post,
    foreignKey: 'blogId'
  });

  MetadataStorage.addEntity(Post, 'posts');
  MetadataStorage.addPrimaryKey(Post, 'id');
  MetadataStorage.addRelationship(Post, {
    propertyName: 'tags',
    type: 'one-to-many',
    targetEntity: Tag,
    foreignKey: 'postId'
  });

  MetadataStorage.addEntity(Tag, 'tags');
  MetadataStorage.addPrimaryKey(Tag, 'id');
}

// ── Stub EntityLoader ─────────────────────────────────────────────────────────

interface LoaderCall {
  method: 'regular' | 'filtered';
  propNames: string[];
}

function makeLoader(posts?: Post[]): { loader: EntityLoader; calls: LoaderCall[] } {
  const calls: LoaderCall[] = [];
  const loader: EntityLoader = {
    populateRelationshipsMany: async (
      _entities: unknown[],
      _entityClass: unknown,
      options: { includes?: string[] }
    ) => {
      calls.push({ method: 'regular', propNames: options.includes ?? [] });
    },
    populateFilteredRelationshipsMany: async (
      entities: unknown[],
      _entityClass: unknown,
      specs: Map<string, IncludeSubquery<unknown>>
    ) => {
      calls.push({ method: 'filtered', propNames: [...specs.keys()] });
      if (posts === undefined) return;
      for (const [propName, spec] of specs) {
        if (propName === 'posts') {
          for (const entity of entities as Blog[]) {
            const related = posts.filter((p) => p.blogId === entity.id);
            (entity as unknown as Record<string, unknown>)[propName] = spec.applyFilter(related);
          }
        }
      }
    }
  } as unknown as EntityLoader;
  return { loader, calls };
}

// ── Stub DatabaseProvider (minimal, no queries) ───────────────────────────────

function makeProvider(): import('@ts-linq/core').DatabaseProvider {
  return {
    getDialect: () => ({
      buildSelect: () => ({ query: 'SELECT 1', parameters: [] }),
      quoteIdentifier: (id: string) => `"${id}"`
    }),
    executeQuery: async () => [],
    findWhereIn: async () => [],
    loggerRef: undefined,
    providerLabel: 'test',
    softDeleteOptions: undefined
  } as unknown as import('@ts-linq/core').DatabaseProvider;
}

// ─────────────────────────────────────────────────────────────────────────────
// IncludeSubquery API
// ─────────────────────────────────────────────────────────────────────────────

describe('IncludeSubquery', () => {
  describe('construction and isFiltered', () => {
    it('bare IncludeSubquery has isFiltered === false', () => {
      const sub = new IncludeSubquery<Post>('posts');
      expect(sub.propertyName).toBe('posts');
      expect(sub.isFiltered).toBe(false);
    });

    it('after where() isFiltered is true', () => {
      const sub = new IncludeSubquery<Post>('posts').where((p) => p.isPublished);
      expect(sub.isFiltered).toBe(true);
    });

    it('after take() isFiltered is true', () => {
      const sub = new IncludeSubquery<Post>('posts').take(5);
      expect(sub.isFiltered).toBe(true);
    });

    it('after skip() isFiltered is true', () => {
      const sub = new IncludeSubquery<Post>('posts').skip(2);
      expect(sub.isFiltered).toBe(true);
    });

    it('after orderBy() isFiltered is true', () => {
      const sub = new IncludeSubquery<Post>('posts').orderBy((p) => p.title);
      expect(sub.isFiltered).toBe(true);
    });

    it('IncludeSubquery is immutable — chaining returns new instances', () => {
      const base = new IncludeSubquery<Post>('posts');
      const withWhere = base.where((p) => p.isPublished);
      expect(withWhere).not.toBe(base);
      expect(base.isFiltered).toBe(false);
      expect(withWhere.isFiltered).toBe(true);
    });
  });

  describe('applyFilter — where', () => {
    const posts: Post[] = [
      Object.assign(new Post(), { id: 1, title: 'A', isPublished: true, blogId: 1 }),
      Object.assign(new Post(), { id: 2, title: 'B', isPublished: false, blogId: 1 }),
      Object.assign(new Post(), { id: 3, title: 'C', isPublished: true, blogId: 1 })
    ];

    it('where filters items in-memory', () => {
      const sub = new IncludeSubquery<Post>('posts').where((p) => p.isPublished);
      const result = sub.applyFilter(posts) as Post[];
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.isPublished)).toBe(true);
    });

    it('multiple where calls are ANDed', () => {
      const sub = new IncludeSubquery<Post>('posts')
        .where((p) => p.isPublished)
        .where((p) => p.id > 1);
      const result = sub.applyFilter(posts) as Post[];
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it('returns empty array when nothing matches', () => {
      const sub = new IncludeSubquery<Post>('posts').where(() => false);
      expect(sub.applyFilter(posts)).toHaveLength(0);
    });

    it('returns all when predicate always passes', () => {
      const sub = new IncludeSubquery<Post>('posts').where(() => true);
      expect(sub.applyFilter(posts)).toHaveLength(3);
    });
  });

  describe('applyFilter — orderBy / orderByDescending', () => {
    const posts: Post[] = [
      Object.assign(new Post(), { id: 2, title: 'B' }),
      Object.assign(new Post(), { id: 1, title: 'A' }),
      Object.assign(new Post(), { id: 3, title: 'C' })
    ];

    it('orderBy sorts ascending', () => {
      const sub = new IncludeSubquery<Post>('posts').orderBy((p) => p.id);
      const result = sub.applyFilter(posts) as Post[];
      expect(result.map((p) => p.id)).toEqual([1, 2, 3]);
    });

    it('orderByDescending sorts descending', () => {
      const sub = new IncludeSubquery<Post>('posts').orderByDescending((p) => p.id);
      const result = sub.applyFilter(posts) as Post[];
      expect(result.map((p) => p.id)).toEqual([3, 2, 1]);
    });

    it('does not mutate the original array', () => {
      const firstId = posts[0].id;
      const sub = new IncludeSubquery<Post>('posts').orderBy((p) => p.id);
      sub.applyFilter(posts);
      expect(posts[0].id).toBe(firstId);
    });
  });

  describe('applyFilter — thenBy / thenByDescending', () => {
    const posts = [
      Object.assign(new Post(), { id: 3, title: 'B' }),
      Object.assign(new Post(), { id: 1, title: 'A' }),
      Object.assign(new Post(), { id: 2, title: 'A' })
    ];

    it('thenBy adds secondary ascending sort', () => {
      const sub = new IncludeSubquery<Post>('posts').orderBy((p) => p.title).thenBy((p) => p.id);
      const result = sub.applyFilter(posts) as Post[];
      expect(result.map((p) => p.id)).toEqual([1, 2, 3]);
    });

    it('thenByDescending adds secondary descending sort', () => {
      const sub = new IncludeSubquery<Post>('posts')
        .orderBy((p) => p.title)
        .thenByDescending((p) => p.id);
      const result = sub.applyFilter(posts) as Post[];
      // title A: ids 2,1 (desc); title B: id 3
      expect(result.map((p) => p.id)).toEqual([2, 1, 3]);
    });
  });

  describe('applyFilter — skip / take', () => {
    const posts: Post[] = Array.from({ length: 10 }, (_, i) =>
      Object.assign(new Post(), { id: i + 1 })
    );

    it('take limits the result', () => {
      const sub = new IncludeSubquery<Post>('posts').take(3);
      expect(sub.applyFilter(posts)).toHaveLength(3);
    });

    it('skip skips the first N', () => {
      const sub = new IncludeSubquery<Post>('posts').skip(7);
      const result = sub.applyFilter(posts) as Post[];
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(8);
    });

    it('skip + take combined', () => {
      const sub = new IncludeSubquery<Post>('posts').skip(2).take(3);
      const result = sub.applyFilter(posts) as Post[];
      expect(result.map((p) => p.id)).toEqual([3, 4, 5]);
    });

    it('take 0 returns empty', () => {
      const sub = new IncludeSubquery<Post>('posts').take(0);
      expect(sub.applyFilter(posts)).toHaveLength(0);
    });

    it('take beyond length returns all', () => {
      const sub = new IncludeSubquery<Post>('posts').take(100);
      expect(sub.applyFilter(posts)).toHaveLength(10);
    });
  });

  describe('combined where + orderByDescending + take', () => {
    it('where + orderByDescending + take works together', () => {
      const posts: Post[] = [
        Object.assign(new Post(), {
          id: 1,
          isPublished: true,
          publishedAt: new Date('2024-01-01')
        }),
        Object.assign(new Post(), {
          id: 2,
          isPublished: false,
          publishedAt: new Date('2024-06-01')
        }),
        Object.assign(new Post(), {
          id: 3,
          isPublished: true,
          publishedAt: new Date('2024-03-01')
        }),
        Object.assign(new Post(), {
          id: 4,
          isPublished: true,
          publishedAt: new Date('2024-12-01')
        }),
        Object.assign(new Post(), { id: 5, isPublished: true, publishedAt: new Date('2024-09-01') })
      ];
      const sub = new IncludeSubquery<Post>('posts')
        .where((p) => p.isPublished)
        .orderByDescending((p) => p.publishedAt)
        .take(2);
      const result = sub.applyFilter(posts) as Post[];
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(4); // Dec
      expect(result[1].id).toBe(5); // Sep
    });
  });

  describe('forbidden operators', () => {
    it('select() throws', () => {
      const sub = new IncludeSubquery<Post>('posts');
      expect(() => sub.select()).toThrow("'select' is not allowed inside include()");
    });

    it('groupBy() throws', () => {
      const sub = new IncludeSubquery<Post>('posts');
      expect(() => sub.groupBy()).toThrow("'groupBy' is not allowed inside include()");
    });

    it('join() throws', () => {
      const sub = new IncludeSubquery<Post>('posts');
      expect(() => sub.join()).toThrow("'join' is not allowed inside include()");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Queryable.include() overload detection
// ─────────────────────────────────────────────────────────────────────────────

describe('Queryable.include() overload', () => {
  beforeEach(() => {
    MetadataStorage.reset();
    registerAll();
  });
  afterEach(() => MetadataStorage.reset());

  function makeQueryable(): Queryable<Blog> {
    return new Queryable<Blog>(Blog, makeProvider());
  }

  it('string key: simple include added to _includes', () => {
    const q = makeQueryable();
    q.include('posts');
    expect((q as unknown as { _includes: string[] })._includes).toContain('posts');
    expect(
      (q as unknown as { _filteredIncludes: Map<string, unknown> })._filteredIncludes.size
    ).toBe(0);
  });

  it('plain lambda: simple include added to _includes', () => {
    const q = makeQueryable();
    q.include((b: Blog) => b.posts as unknown as Blog['posts']);
    expect((q as unknown as { _includes: string[] })._includes).toContain('posts');
    expect(
      (q as unknown as { _filteredIncludes: Map<string, unknown> })._filteredIncludes.size
    ).toBe(0);
  });

  it('filtered lambda: stored in _filteredIncludes', () => {
    const q = makeQueryable();
    // Use a type-safe filtered lambda via any casting (as the NavigationProxy types need it at runtime)
    q.include((b: unknown) =>
      (b as Record<string, IncludeSubquery<Post>>).posts.where((p: Post) => p.isPublished)
    );
    const fi = (q as unknown as { _filteredIncludes: Map<string, IncludeSubquery<unknown>> })
      ._filteredIncludes;
    expect(fi.has('posts')).toBe(true);
    expect(fi.get('posts')!.isFiltered).toBe(true);
    expect((q as unknown as { _includes: string[] })._includes).not.toContain('posts');
  });

  it('take-only filtered lambda: stored in _filteredIncludes', () => {
    const q = makeQueryable();
    q.include((b: unknown) => (b as Record<string, IncludeSubquery<Post>>).posts.take(5));
    const fi = (q as unknown as { _filteredIncludes: Map<string, IncludeSubquery<unknown>> })
      ._filteredIncludes;
    expect(fi.has('posts')).toBe(true);
    expect(fi.get('posts')!.isFiltered).toBe(true);
  });

  it('clone() propagates _filteredIncludes', () => {
    const q = makeQueryable();
    q.include((b: unknown) => (b as Record<string, IncludeSubquery<Post>>).posts.take(5));
    const cloned = q.clone();
    const fi = (cloned as unknown as { _filteredIncludes: Map<string, IncludeSubquery<unknown>> })
      ._filteredIncludes;
    expect(fi.has('posts')).toBe(true);
  });

  it('throws IncludeResolutionError for unknown property', () => {
    const q = makeQueryable();
    let thrown: unknown;
    try {
      q.include('nonExistent' as keyof Blog & string);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(IncludeResolutionError);
    expect((thrown as IncludeResolutionError).code).toBe('UNKNOWN_PROPERTY');
  });

  it('forbidden operator inside include lambda throws', () => {
    const q = makeQueryable();
    expect(() =>
      q.include((b: unknown) => (b as Record<string, IncludeSubquery<Post>>).posts.select())
    ).toThrow("'select' is not allowed inside include()");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IncludePlanner filtered path
// ─────────────────────────────────────────────────────────────────────────────

describe('IncludePlanner with filteredIncludes', () => {
  beforeEach(() => {
    MetadataStorage.reset();
    registerAll();
  });
  afterEach(() => MetadataStorage.reset());

  it('calls populateFilteredRelationshipsMany and applies filter per parent', async () => {
    const post1 = Object.assign(new Post(), { id: 10, title: 'P1', isPublished: true, blogId: 1 });
    const post2 = Object.assign(new Post(), { id: 11, title: 'P2', isPublished: false, blogId: 1 });
    const { loader } = makeLoader([post1, post2]);
    const planner = new IncludePlanner<Blog>(loader, Blog);

    const blog = Object.assign(new Blog(), { id: 1, name: 'B1' });
    const spec = new IncludeSubquery<Post>('posts').where((p) => p.isPublished);
    await planner.populateIncludes([blog], [], undefined, undefined, new Map([['posts', spec]]));

    expect(blog.posts).toHaveLength(1);
    expect(blog.posts[0].id).toBe(10);
  });

  it('filtered include for top-level key skips regular batch load for that key', async () => {
    const post1 = Object.assign(new Post(), { id: 10, title: 'P1', isPublished: true, blogId: 1 });
    const { loader, calls } = makeLoader([post1]);
    const planner = new IncludePlanner<Blog>(loader, Blog);

    const blog = Object.assign(new Blog(), { id: 1, name: 'B1' });
    const spec = new IncludeSubquery<Post>('posts').where((p) => p.isPublished);

    // Pass 'posts' in BOTH includes AND filteredIncludes — regular load should NOT call posts
    await planner.populateIncludes(
      [blog],
      ['posts'],
      undefined,
      undefined,
      new Map([['posts', spec]])
    );

    const regularCallsWithPosts = calls
      .filter((c) => c.method === 'regular')
      .some((c) => c.propNames.includes('posts'));
    expect(regularCallsWithPosts).toBe(false);
  });

  it('does nothing when entityLoader is undefined', async () => {
    const planner = new IncludePlanner<Blog>(undefined, Blog);
    const blog = Object.assign(new Blog(), { id: 1 });
    const spec = new IncludeSubquery<Post>('posts').take(1);
    await expect(
      planner.populateIncludes([blog], [], undefined, undefined, new Map([['posts', spec]]))
    ).resolves.toBeUndefined();
  });

  it('does nothing when limit === 1', async () => {
    const { loader, calls } = makeLoader([]);
    const planner = new IncludePlanner<Blog>(loader, Blog);
    const blog = Object.assign(new Blog(), { id: 1 });
    const spec = new IncludeSubquery<Post>('posts').take(1);
    await planner.populateIncludes([blog], [], 1, undefined, new Map([['posts', spec]]));
    expect(calls.length).toBe(0);
  });

  it('multiple parents each get filtered independently', async () => {
    const posts = [
      Object.assign(new Post(), { id: 10, isPublished: true, blogId: 1 }),
      Object.assign(new Post(), { id: 11, isPublished: false, blogId: 1 }),
      Object.assign(new Post(), { id: 20, isPublished: true, blogId: 2 }),
      Object.assign(new Post(), { id: 21, isPublished: true, blogId: 2 })
    ];
    const { loader } = makeLoader(posts);
    const planner = new IncludePlanner<Blog>(loader, Blog);

    const blog1 = Object.assign(new Blog(), { id: 1 });
    const blog2 = Object.assign(new Blog(), { id: 2 });
    const spec = new IncludeSubquery<Post>('posts').where((p) => p.isPublished);
    await planner.populateIncludes(
      [blog1, blog2],
      [],
      undefined,
      undefined,
      new Map([['posts', spec]])
    );

    expect(blog1.posts).toHaveLength(1);
    expect(blog2.posts).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// thenInclude after filtered include
// ─────────────────────────────────────────────────────────────────────────────

describe('thenInclude after filtered include', () => {
  beforeEach(() => {
    MetadataStorage.reset();
    registerAll();
  });
  afterEach(() => MetadataStorage.reset());

  it('thenInclude correctly builds nested path posts.tags', () => {
    const q = new Queryable<Blog>(Blog, makeProvider());
    q.include((b: unknown) =>
      (b as Record<string, IncludeSubquery<Post>>).posts.where((p: Post) => p.isPublished)
    );
    q.thenInclude((p: unknown) => (p as Post).tags);

    expect((q as unknown as { _includes: string[] })._includes).toContain('posts.tags');
    expect(
      (q as unknown as { _filteredIncludes: Map<string, unknown> })._filteredIncludes.has('posts')
    ).toBe(true);
  });
});
