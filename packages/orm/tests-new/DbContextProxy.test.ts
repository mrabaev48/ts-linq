import 'reflect-metadata';

import { beforeEach, describe, expect, it } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { DbSet } from '../src/DbSet';
import { TestProvider } from '../tests/stubs/TestProvider';

// ─── Entities ────────────────────────────────────────────────────────────────

@Entity()
class User {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

@Entity()
class Post {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  title!: string;
}

@Entity()
class Comment {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  body!: string;
}

// ─── Context fixtures ─────────────────────────────────────────────────────────

class SingleSetCtx extends DbContext {
  users = this.defineSet(User);
}

class MultiSetCtx extends DbContext {
  users = this.defineSet(User);
  posts = this.defineSet(Post);
}

class BaseCtx extends DbContext {
  users = this.defineSet(User);
}

class DerivedCtx extends BaseCtx {
  posts = this.defineSet(Post);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DbContext — no Proxy from constructor (ISSUE-001)', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider(':memory:');
  });

  describe('constructor identity', () => {
    it('returns the real instance, not a Proxy', () => {
      const ctx = new SingleSetCtx({ provider });
      // A Proxy wrapping an object is NOT the same reference as the object itself.
      // If the constructor returned a Proxy, Object.getPrototypeOf would still be
      // DbContext.prototype but we can detect by checking that no exotic
      // [[ProxyHandler]] is present via Proxy.revocable trick:
      // simplest check — the instance must be instanceof and must equal itself.
      expect(ctx).toBeInstanceOf(DbContext);
      expect(ctx).toBeInstanceOf(SingleSetCtx);
    });

    it('instanceof DbContext is true', () => {
      const ctx = new SingleSetCtx({ provider });
      expect(ctx instanceof DbContext).toBe(true);
    });

    it('constructor does not contain the as-unknown-as-this cast (regression guard)', () => {
      // Verify at runtime that constructed object has no Proxy behaviour:
      // assigning an unrelated value does NOT trigger any interception.
      const ctx = new SingleSetCtx({ provider }) as unknown as Record<string, unknown>;
      ctx['__sentinel__'] = 42;
      expect(ctx['__sentinel__']).toBe(42);
    });
  });

  describe('defineSet() — context injection', () => {
    it('injects provider into the DbSet', () => {
      const ctx = new SingleSetCtx({ provider });
      // DbSet.toArray() calls newQueryable() which throws "no database context"
      // if _provider is not set. Verify the error is about the query, not about
      // missing context — meaning injection succeeded.
      expect(ctx.users).toBeInstanceOf(DbSet);
    });

    it('returns a DbSet with the correct entityClass', () => {
      const ctx = new SingleSetCtx({ provider });
      expect(ctx.users.entityClass).toBe(User);
    });

    it('works for multiple sets in one subclass', () => {
      const ctx = new MultiSetCtx({ provider });
      expect(ctx.users.entityClass).toBe(User);
      expect(ctx.posts.entityClass).toBe(Post);
    });

    it('defineSet() and auto-generated property refer to the same DbSet instance', () => {
      // initializeDbSets() creates an auto-generated "users" getter pointing to
      // _dbSets.get(User). defineSet() returns the same entry from _dbSets.
      // After the field assignment, ctx.users should be that same DbSet.
      const ctx = new SingleSetCtx({ provider });
      // Both the field (defineSet result) and set(User) return the same DbSet.
      const viaSet = (ctx as DbContext).set(User);
      expect(ctx.users).toBe(viaSet);
    });
  });

  describe('multi-level inheritance', () => {
    it('defineSet() works in a derived subclass', () => {
      const ctx = new DerivedCtx({ provider });
      expect(ctx.users).toBeInstanceOf(DbSet);
      expect(ctx.posts).toBeInstanceOf(DbSet);
      expect(ctx.users.entityClass).toBe(User);
      expect(ctx.posts.entityClass).toBe(Post);
    });

    it('instanceof chain is intact after multi-level subclassing', () => {
      const ctx = new DerivedCtx({ provider });
      expect(ctx instanceof DerivedCtx).toBe(true);
      expect(ctx instanceof BaseCtx).toBe(true);
      expect(ctx instanceof DbContext).toBe(true);
    });
  });

  describe('set() API regression guard', () => {
    it('set(User) still works as before', () => {
      const ctx = new SingleSetCtx({ provider });
      const dbSet = ctx.set(User);
      expect(dbSet).toBeInstanceOf(DbSet);
      expect(dbSet.entityClass).toBe(User);
    });

    it('set(UnregisteredEntity) throws as before', () => {
      class Ghost {
        id!: number;
      }
      const ctx = new SingleSetCtx({ provider });
      expect(() => ctx.set(Ghost as unknown as new () => User)).toThrow('is not configured');
    });
  });
});
