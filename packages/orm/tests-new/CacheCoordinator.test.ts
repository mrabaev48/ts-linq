import 'reflect-metadata';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CacheCoordinator } from '../src/services/CacheCoordinator';
import type { EntityCacheLike, CountCache } from '@ts-linq/types';

// ── Mock helpers ─────────────────────────────────────────────────────────────

function makeEntityCache(): EntityCacheLike & { store: Map<string, unknown>; cleared: boolean } {
  const store = new Map<string, unknown>();
  return {
    store,
    cleared: false,
    get<T>(_ec: Function, id: unknown): T | undefined {
      return store.get(String(id)) as T | undefined;
    },
    set<T>(_ec: Function, id: unknown, entity: T): void {
      store.set(String(id), entity);
    },
    remove(_ec: Function, id: unknown): void {
      store.delete(String(id));
    },
    clear(): void {
      store.clear();
      (this as { cleared: boolean }).cleared = true;
    },
    size(): number {
      return store.size;
    }
  };
}

function makeSqlCache(): { invalidateBy: (m: (k: string) => boolean) => number } {
  return {
    invalidateBy: jest.fn((_matcher: (k: string) => boolean): number => 0)
  };
}

function makeCountCache(): CountCache & { cleared: boolean } {
  const store = new Map<string, number>();
  let cleared = false;
  return {
    get cleared() {
      return cleared;
    },
    get(key: string) {
      return store.get(key);
    },
    set(key: string, value: number) {
      store.set(key, value);
    },
    clear() {
      store.clear();
      cleared = true;
    },
    invalidateBy(matcher: (k: string) => boolean) {
      let removed = 0;
      for (const k of [...store.keys()]) {
        if (matcher(k)) {
          store.delete(k);
          removed++;
        }
      }
      return removed;
    }
  };
}

function makeRegistry(entities: Array<{ target?: Function }> = []) {
  return { getEntities: () => entities };
}

class User {
  id!: number;
}

function makeCoordinator(
  entityCache: EntityCacheLike | undefined,
  sqlCache: ReturnType<typeof makeSqlCache> | undefined,
  countCache: (CountCache & { cleared: boolean }) | undefined,
  pkFn: (ec: Function) => string | undefined = (ec) => (ec === User ? 'id' : undefined)
) {
  return new CacheCoordinator(entityCache, sqlCache, countCache, 'pg', 'ns', makeRegistry(), pkFn);
}

// ── Entry management ─────────────────────────────────────────────────────────

describe('CacheCoordinator — entry management', () => {
  let ec: ReturnType<typeof makeEntityCache>;
  let coord: CacheCoordinator;

  beforeEach(() => {
    ec = makeEntityCache();
    coord = makeCoordinator(ec, makeSqlCache(), makeCountCache());
  });

  it('updateEntry stores entity by primary key', () => {
    const entity = { id: 42, name: 'Alice' };
    coord.updateEntry({ entity, entityClass: User });
    expect(ec.get(User, 42)).toBe(entity);
  });

  it('updateEntry is a no-op when entityCache is absent', () => {
    const c = makeCoordinator(undefined, makeSqlCache(), makeCountCache());
    expect(() => c.updateEntry({ entity: { id: 1 }, entityClass: User })).not.toThrow();
  });

  it('updateEntry is a no-op when primary key is unknown', () => {
    const c = makeCoordinator(ec, makeSqlCache(), makeCountCache(), () => undefined);
    c.updateEntry({ entity: { id: 1 }, entityClass: User });
    expect(ec.store.size).toBe(0);
  });

  it('removeEntry removes entity from entityCache', () => {
    ec.set(User, 99, { id: 99 });
    coord.removeEntry({ entity: { id: 99 }, entityClass: User });
    expect(ec.get(User, 99)).toBeUndefined();
  });

  it('removeEntry is a no-op when entityCache is absent', () => {
    const c = makeCoordinator(undefined, makeSqlCache(), makeCountCache());
    expect(() => c.removeEntry({ entity: { id: 1 }, entityClass: User })).not.toThrow();
  });
});

// ── Invalidation ─────────────────────────────────────────────────────────────

describe('CacheCoordinator — invalidation', () => {
  let ec: ReturnType<typeof makeEntityCache>;
  let sql: ReturnType<typeof makeSqlCache>;
  let cnt: ReturnType<typeof makeCountCache>;
  let coord: CacheCoordinator;

  beforeEach(() => {
    ec = makeEntityCache();
    sql = makeSqlCache();
    cnt = makeCountCache();
    coord = makeCoordinator(ec, sql, cnt);
  });

  describe('invalidateAfterMutation', () => {
    it('removes deleted entities by primary key', () => {
      ec.set(User, 7, { id: 7 });
      coord.invalidateAfterMutation([{ entity: { id: 7 }, entityClass: User, state: 'deleted' }]);
      expect(ec.get(User, 7)).toBeUndefined();
    });

    it('does not remove modified entities from entityCache', () => {
      const entity = { id: 5 };
      ec.set(User, 5, entity);
      coord.invalidateAfterMutation([{ entity: { id: 5 }, entityClass: User, state: 'modified' }]);
      expect(ec.get(User, 5)).toBe(entity);
    });

    it('calls sqlCache.invalidateBy', () => {
      coord.invalidateAfterMutation([{ entity: { id: 1 }, entityClass: User, state: 'modified' }]);
      expect(sql.invalidateBy).toHaveBeenCalled();
    });

    it('invalidates count cache entries by entity name prefix', () => {
      cnt.set('ns|pg|User|count|all', 10);
      cnt.set('ns|pg|Other|count|all', 5);
      coord.invalidateAfterMutation([{ entity: { id: 1 }, entityClass: User, state: 'added' }]);
      expect(cnt.get('ns|pg|User|count|all')).toBeUndefined();
      expect(cnt.get('ns|pg|Other|count|all')).toBe(5);
    });

    it('performs full L2 clear when cachePolicy invalidateOn matches', () => {
      class Order {}
      Reflect.defineMetadata('orm:cachePolicy', { invalidateOn: ['User'] }, Order);

      const c = new CacheCoordinator(
        ec,
        sql,
        cnt,
        'pg',
        'ns',
        makeRegistry([{ target: Order }]),
        (cls) => (cls === User ? 'id' : undefined)
      );

      ec.set(User, 1, { id: 1 });
      c.invalidateAfterMutation([{ entity: { id: 1 }, entityClass: User, state: 'modified' }]);
      expect(ec.cleared).toBe(true);
    });

    it('does not throw when all caches are absent', () => {
      const c = makeCoordinator(undefined, undefined, undefined, () => undefined);
      expect(() =>
        c.invalidateAfterMutation([{ entity: { id: 1 }, entityClass: User, state: 'added' }])
      ).not.toThrow();
    });
  });

  describe('invalidateOnCommit', () => {
    it('clears entityCache', () => {
      ec.set(User, 1, { id: 1 });
      coord.invalidateOnCommit();
      expect(ec.cleared).toBe(true);
    });

    it('is a no-op when entityCache is absent', () => {
      expect(() => makeCoordinator(undefined, sql, cnt).invalidateOnCommit()).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('clears entityCache and countCache', () => {
      ec.set(User, 1, { id: 1 });
      cnt.set('key', 10);
      coord.clearAll();
      expect(ec.cleared).toBe(true);
      expect(cnt.cleared).toBe(true);
    });

    it('does not throw when caches are absent', () => {
      expect(() => makeCoordinator(undefined, undefined, undefined).clearAll()).not.toThrow();
    });
  });

  describe('invalidateByEntityNames', () => {
    it('calls sqlCache.invalidateBy', () => {
      coord.invalidateByEntityNames(['User']);
      expect(sql.invalidateBy).toHaveBeenCalled();
    });

    it('invalidates count cache entries containing entity name', () => {
      cnt.set('ns|pg|User|count|all', 42);
      cnt.set('ns|pg|Other|count|all', 7);
      coord.invalidateByEntityNames(['User']);
      expect(cnt.get('ns|pg|User|count|all')).toBeUndefined();
      expect(cnt.get('ns|pg|Other|count|all')).toBe(7);
    });

    it('does not throw when caches are absent', () => {
      expect(() =>
        makeCoordinator(undefined, undefined, undefined).invalidateByEntityNames(['User'])
      ).not.toThrow();
    });
  });
});
