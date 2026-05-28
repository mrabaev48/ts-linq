/**
 * Integration tests — ExecuteUpdate / ExecuteDelete (P0-04).
 *
 * Verifies:
 * - executeDelete() generates correct DELETE SQL via TestProvider/TestDialect
 * - executeUpdate() generates correct UPDATE SQL via TestProvider/TestDialect
 * - WHERE clauses are forwarded to the SQL
 * - Returned rowsAffected count flows through correctly
 * - include() before either method throws a descriptive error
 * - DbSet.executeUpdate() / executeDelete() delegate to the underlying Queryable
 */
import 'reflect-metadata';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, DbContextOptionsBuilder } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

// ── Entity fixtures ───────────────────────────────────────────────────────────

@Entity({ name: 'eu_users' })
class EuUser {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ name: 'is_locked' })
  isLocked!: boolean;

  @Column({ name: 'login_count' })
  loginCount!: number;

  @Column({ name: 'display_name' })
  displayName!: string;
}

@Entity({ name: 'eu_logs' })
class EuLog {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ name: 'created_at' })
  createdAt!: Date;

  @Column()
  message!: string;
}

// ── DbContext ─────────────────────────────────────────────────────────────────

class EuContext extends DbContext {
  users = this.set(EuUser);
  logs = this.set(EuLog);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(): { ctx: EuContext; provider: TestProvider } {
  const provider = new TestProvider(':memory:');
  const opts = new DbContextOptionsBuilder({ provider }).build();
  const ctx = new EuContext(opts);
  return { ctx, provider };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ExecuteUpdate / ExecuteDelete — integration (P0-04)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── executeDelete ──────────────────────────────────────────────────────────

  describe('executeDelete()', () => {
    it('calls executeNonQuery with DELETE FROM <table>', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      await ctx.logs.executeDelete();

      expect(spy).toHaveBeenCalledTimes(1);
      const [sql] = spy.mock.calls[0] as [string, ...unknown[]];
      expect(sql).toMatch(/DELETE FROM/i);
      expect(sql).toContain('eu_logs');
    });

    it('appends WHERE clause when where() is chained', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      // whereCompiled with a pre-built condition
      await ctx.logs
        .whereCompiled({
          ast: {
            type: 'binary',
            operator: '==',
            left: { type: 'property', name: 'id' },
            right: { type: 'literal', value: 1 }
          },
          parameters: []
        })
        .executeDelete();

      const [sql] = spy.mock.calls[0] as [string, ...unknown[]];
      expect(sql).toMatch(/WHERE/i);
    });

    it('returns the rowsAffected count (TestProvider returns 1 by default)', async () => {
      const { ctx } = makeCtx();
      await ctx.ensureCreated();

      const count = await ctx.logs.executeDelete();

      expect(typeof count).toBe('number');
    });

    it('throws when include() is chained before executeDelete()', async () => {
      const { ctx } = makeCtx();
      await ctx.ensureCreated();

      // Simulate include()-then-executeDelete: since EuLog has no actual
      // relationships we cannot call include() directly, so we get a Queryable
      // via a valid whereCompiled call and then push a fake entry into _includes.
      const q = ctx.logs.whereCompiled({
        ast: {
          type: 'binary',
          operator: '==',
          left: { type: 'property', name: 'id' },
          right: { type: 'literal', value: 0 }
        },
        parameters: []
      });
      (q as unknown as { _includes: string[] })._includes.push('fake');

      await expect(q.executeDelete()).rejects.toThrow(/Cannot call executeDelete/);
    });
  });

  // ── executeUpdate ──────────────────────────────────────────────────────────

  describe('executeUpdate()', () => {
    it('calls executeNonQuery with UPDATE SET SQL', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      await ctx.users.executeUpdate((s) => s.setProperty((u) => u.isLocked, true));

      expect(spy).toHaveBeenCalledTimes(1);
      const [sql, params] = spy.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/UPDATE/i);
      expect(sql).toContain('eu_users');
      expect(sql).toContain('is_locked');
      expect(params).toContain(true);
    });

    it('includes SET clause for a literal string value', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      await ctx.users.executeUpdate((s) => s.setProperty((u) => u.name, 'Admin'));

      const [sql, params] = spy.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('name');
      expect(params).toContain('Admin');
    });

    it('supports multiple setProperty() calls in one executeUpdate()', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      await ctx.users.executeUpdate((s) =>
        s.setProperty((u) => u.name, 'Locked').setProperty((u) => u.isLocked, true)
      );

      const [sql, params] = spy.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('name');
      expect(sql).toContain('is_locked');
      expect(params).toContain('Locked');
      expect(params).toContain(true);
    });

    it('uses a JS-precomputed value as a literal (simulated computed value)', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      const currentCount = 10;
      await ctx.users.executeUpdate((s) => s.setProperty((u) => u.loginCount, currentCount + 1));

      const [, params] = spy.mock.calls[0] as [string, unknown[]];
      expect(params).toContain(11);
    });

    it('copies column reference — name = displayName', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      await ctx.users.executeUpdate((s) =>
        s.setProperty(
          (u) => u.name,
          (u) => u.displayName
        )
      );

      const [sql, params] = spy.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('display_name');
      // Column reference — no parameter for this setter
      expect(params).not.toContain('display_name');
    });

    it('appends WHERE clause from whereCompiled()', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      await ctx.users
        .whereCompiled({
          ast: {
            type: 'binary',
            operator: '==',
            left: { type: 'property', name: 'id' },
            right: { type: 'literal', value: 99 }
          },
          parameters: []
        })
        .executeUpdate((s) => s.setProperty((u) => u.isLocked, true));

      const [sql] = spy.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/WHERE/i);
    });

    it('throws when include() is chained before executeUpdate()', async () => {
      const { ctx } = makeCtx();
      await ctx.ensureCreated();

      // Same pattern: get a Queryable via a valid whereCompiled, then push a
      // fake entry into _includes to simulate include()-before-executeUpdate.
      const q = ctx.users.whereCompiled({
        ast: {
          type: 'binary',
          operator: '==',
          left: { type: 'property', name: 'id' },
          right: { type: 'literal', value: 0 }
        },
        parameters: []
      });
      (q as unknown as { _includes: string[] })._includes.push('fake');

      await expect(q.executeUpdate((s) => s.setProperty((u) => u.name, 'Test'))).rejects.toThrow(
        /Cannot call executeUpdate/
      );
    });

    it('throws when no setProperty() calls are made', async () => {
      const { ctx } = makeCtx();
      await ctx.ensureCreated();

      await expect(ctx.users.executeUpdate((s) => s)).rejects.toThrow(/at least one setProperty/);
    });

    it('DbSet.executeUpdate delegates to Queryable — single call to executeNonQuery', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      await ctx.users.executeUpdate((s) => s.setProperty((u) => u.isLocked, false));

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('DbSet.executeDelete delegates to Queryable — single call to executeNonQuery', async () => {
      const { ctx, provider } = makeCtx();
      await ctx.ensureCreated();

      const spy = jest.spyOn(provider, 'executeNonQuery');

      await ctx.users.executeDelete();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
