/**
 * Unit tests for the P0-12 EF-style interceptor infrastructure:
 *   - InterceptionResult<T>
 *   - InterceptorRegistry (duck-typing partitioning)
 *   - DbContextOptionsBuilder.addInterceptors()
 *   - ISaveChangesInterceptor pipeline (savingChanges / savedChanges / saveChangesFailed)
 *   - AuditInterceptor.savingChanges() with event-data entries
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DbContextOptions } from '@ts-linq/core';
import {
  type IDbCommandInterceptor,
  type IDbConnectionInterceptor,
  type IDbTransactionInterceptor,
  type IMaterializationInterceptor,
  InterceptionResult,
  type ISaveChangesInterceptor,
  type SaveChangesEventData
} from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { DbContextOptionsBuilder } from '../src/DbContextOptionsBuilder';
import { InterceptorRegistry } from '../src/interceptors/InterceptorRegistry';
import { AuditInterceptor } from '../src/services/AuditInterceptor';
import { TestProvider } from '../tests/stubs/TestProvider';

// ── Shared entity fixture ────────────────────────────────────────────────────

@Entity({ name: 'intercept_items' })
class InterceptItem {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class InterceptContext extends DbContext {
  items = this.set(InterceptItem);
}

// ── 1. InterceptionResult ────────────────────────────────────────────────────

describe('InterceptionResult', () => {
  it('SuppressWithResult sets isSuppressed=true and carries value', () => {
    const r = InterceptionResult.SuppressWithResult(42);
    expect(r.isSuppressed).toBe(true);
    expect(r.result).toBe(42);
  });

  it('NoResult sets isSuppressed=false and result=undefined', () => {
    const r = InterceptionResult.NoResult<number>();
    expect(r.isSuppressed).toBe(false);
    expect(r.result).toBeUndefined();
  });
});

// ── 2. InterceptorRegistry ───────────────────────────────────────────────────

describe('InterceptorRegistry', () => {
  it('isEmpty is true when no interceptors registered', () => {
    const reg = new InterceptorRegistry([]);
    expect(reg.isEmpty).toBe(true);
    expect(reg.forEachSaveChanges()).toHaveLength(0);
    expect(reg.forEachCommand()).toHaveLength(0);
    expect(reg.forEachConnection()).toHaveLength(0);
    expect(reg.forEachTransaction()).toHaveLength(0);
    expect(reg.forEachMaterialization()).toHaveLength(0);
  });

  it('partitions a savingChanges interceptor into saveChanges bucket only', () => {
    const ic: ISaveChangesInterceptor = {
      savingChanges: jest.fn() as unknown as ISaveChangesInterceptor['savingChanges']
    };
    const reg = new InterceptorRegistry([ic]);
    expect(reg.isEmpty).toBe(false);
    expect(reg.forEachSaveChanges()).toContain(ic);
    expect(reg.forEachCommand()).toHaveLength(0);
  });

  it('partitions a nonQueryExecuting interceptor into command bucket only', () => {
    const ic: IDbCommandInterceptor = {
      nonQueryExecuting: jest.fn() as unknown as IDbCommandInterceptor['nonQueryExecuting']
    };
    const reg = new InterceptorRegistry([ic]);
    expect(reg.forEachCommand()).toContain(ic);
    expect(reg.forEachSaveChanges()).toHaveLength(0);
  });

  it('partitions a connectionOpened interceptor into connection bucket', () => {
    const ic: IDbConnectionInterceptor = {
      connectionOpened: jest.fn() as unknown as IDbConnectionInterceptor['connectionOpened']
    };
    const reg = new InterceptorRegistry([ic]);
    expect(reg.forEachConnection()).toContain(ic);
  });

  it('partitions a transactionStarted interceptor into transaction bucket', () => {
    const ic: IDbTransactionInterceptor = {
      transactionStarted: jest.fn() as unknown as IDbTransactionInterceptor['transactionStarted']
    };
    const reg = new InterceptorRegistry([ic]);
    expect(reg.forEachTransaction()).toContain(ic);
  });

  it('partitions an initialized interceptor into materialization bucket', () => {
    const ic: IMaterializationInterceptor = {
      initialized: jest.fn() as unknown as IMaterializationInterceptor['initialized']
    };
    const reg = new InterceptorRegistry([ic]);
    expect(reg.forEachMaterialization()).toContain(ic);
  });

  it('multi-interface interceptor appears in all relevant partitions', () => {
    const ic: ISaveChangesInterceptor & IDbCommandInterceptor = {
      savingChanges: jest.fn() as unknown as ISaveChangesInterceptor['savingChanges'],
      nonQueryExecuting: jest.fn() as unknown as IDbCommandInterceptor['nonQueryExecuting']
    };
    const reg = new InterceptorRegistry([ic]);
    expect(reg.forEachSaveChanges()).toContain(ic);
    expect(reg.forEachCommand()).toContain(ic);
  });

  it('preserves declaration order within a partition', () => {
    const ic1: ISaveChangesInterceptor = {
      savingChanges: jest.fn() as unknown as ISaveChangesInterceptor['savingChanges']
    };
    const ic2: ISaveChangesInterceptor = {
      savedChanges: jest.fn() as unknown as ISaveChangesInterceptor['savedChanges']
    };
    const ic3: ISaveChangesInterceptor = {
      saveChangesFailed: jest.fn() as unknown as ISaveChangesInterceptor['saveChangesFailed']
    };
    const reg = new InterceptorRegistry([ic1, ic2, ic3]);
    expect(reg.forEachSaveChanges()).toEqual([ic1, ic2, ic3]);
  });
});

// ── 3. DbContextOptionsBuilder ───────────────────────────────────────────────

describe('DbContextOptionsBuilder', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider(':memory:');
  });

  it('build() returns base options unchanged when no interceptors added', () => {
    const base: DbContextOptions = { provider };
    const result = new DbContextOptionsBuilder(base).build();
    expect(result.provider).toBe(provider);
    expect(result.interceptors ?? []).toHaveLength(0);
  });

  it('addInterceptors() merges into interceptors array', () => {
    const ic1 = { savingChanges: jest.fn() };
    const ic2 = { nonQueryExecuting: jest.fn() };
    const base: DbContextOptions = { provider };
    const opts = new DbContextOptionsBuilder(base).addInterceptors(ic1, ic2).build();
    expect(opts.interceptors).toContain(ic1);
    expect(opts.interceptors).toContain(ic2);
    expect(opts.interceptors).toHaveLength(2);
  });

  it('addInterceptors() is chainable', () => {
    const ic1 = { savingChanges: jest.fn() };
    const ic2 = { savedChanges: jest.fn() };
    const base: DbContextOptions = { provider };
    const builder = new DbContextOptionsBuilder(base);
    const same = builder.addInterceptors(ic1);
    expect(same).toBe(builder);
    const opts = same.addInterceptors(ic2).build();
    expect(opts.interceptors).toHaveLength(2);
  });

  it('addInterceptors() does not mutate base options', () => {
    const ic = { savingChanges: jest.fn() };
    const base: DbContextOptions = { provider, interceptors: [] };
    new DbContextOptionsBuilder(base).addInterceptors(ic).build();
    expect(base.interceptors).toHaveLength(0);
  });

  it('merges with pre-existing interceptors in base', () => {
    const existing = { savingChanges: jest.fn() };
    const newOne = { savedChanges: jest.fn() };
    const base: DbContextOptions = { provider, interceptors: [existing] };
    const opts = new DbContextOptionsBuilder(base).addInterceptors(newOne).build();
    expect(opts.interceptors).toContain(existing);
    expect(opts.interceptors).toContain(newOne);
    expect(opts.interceptors).toHaveLength(2);
  });
});

// ── 4. ISaveChangesInterceptor pipeline ──────────────────────────────────────

describe('ISaveChangesInterceptor pipeline (DbContext.saveChanges)', () => {
  let provider: TestProvider;
  let ctx: InterceptContext;

  afterEach(async () => {
    await ctx?.dispose?.();
    jest.restoreAllMocks();
  });

  async function makeContext(interceptors: object[]): Promise<InterceptContext> {
    provider = new TestProvider(':memory:');
    await provider.connect();
    ctx = new InterceptContext({ provider, interceptors });
    await ctx.ensureCreated();
    return ctx;
  }

  it('savingChanges() is called before DML with correct entity entries', async () => {
    let capturedEv: SaveChangesEventData | undefined;
    const ic: ISaveChangesInterceptor = {
      savingChanges(ev: SaveChangesEventData, result: InterceptionResult<number>) {
        capturedEv = ev;
        return result;
      }
    };
    const c = await makeContext([ic]);

    const item = new InterceptItem();
    item.name = 'test';
    c.items.add(item);
    await c.saveChanges();

    expect(capturedEv).toBeDefined();
    expect(capturedEv!.entityCount).toBe(1);
    expect(capturedEv!.entries).toHaveLength(1);
    expect(capturedEv!.entries![0].state).toBe('added');
  });

  it('savedChanges() is called after successful DML', async () => {
    let savedCalled = false;
    const ic: ISaveChangesInterceptor = {
      savedChanges(_ev: SaveChangesEventData, result: number) {
        savedCalled = true;
        return result;
      }
    };
    const c = await makeContext([ic]);

    const item = new InterceptItem();
    item.name = 'test';
    c.items.add(item);
    await c.saveChanges();

    expect(savedCalled).toBe(true);
  });

  it('saveChangesFailed() is called when DML throws', async () => {
    let failError: Error | undefined;
    const ic: ISaveChangesInterceptor = {
      saveChangesFailed(_ev: SaveChangesEventData, err: Error) {
        failError = err;
      }
    };

    const p = new TestProvider(':memory:');
    await p.connect();
    const c = new InterceptContext({ provider: p, interceptors: [ic] });
    await c.ensureCreated();
    ctx = c;

    // Force insert to throw
    jest.spyOn(p, 'insert').mockRejectedValueOnce(new Error('db error'));

    const item = new InterceptItem();
    item.name = 'boom';
    c.items.add(item);

    await expect(c.saveChanges()).rejects.toThrow('db error');
    expect(failError).toBeDefined();
    expect(failError!.message).toBe('db error');
  });

  it('SuppressWithResult short-circuits saveChanges and skips DML', async () => {
    const ic: ISaveChangesInterceptor = {
      savingChanges(_ev: SaveChangesEventData, _result: InterceptionResult<number>) {
        return InterceptionResult.SuppressWithResult<number>(99);
      }
    };

    const p = new TestProvider(':memory:');
    await p.connect();
    const c = new InterceptContext({ provider: p, interceptors: [ic] });
    await c.ensureCreated();
    ctx = c;
    const insertSpy = jest.spyOn(p, 'insert');

    const item = new InterceptItem();
    item.name = 'suppressed';
    c.items.add(item);
    const result = await c.saveChanges();

    expect(result).toBe(99);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('interceptors receive calls in registration order', async () => {
    const callOrder: string[] = [];
    const ic1: ISaveChangesInterceptor = {
      savingChanges(_ev: SaveChangesEventData, result: InterceptionResult<number>) {
        callOrder.push('ic1:saving');
        return result;
      }
    };
    const ic2: ISaveChangesInterceptor = {
      savingChanges(_ev: SaveChangesEventData, result: InterceptionResult<number>) {
        callOrder.push('ic2:saving');
        return result;
      }
    };

    const c = await makeContext([ic1, ic2]);

    const item = new InterceptItem();
    item.name = 'order';
    c.items.add(item);
    await c.saveChanges();

    expect(callOrder).toEqual(['ic1:saving', 'ic2:saving']);
  });
});

// ── 5. AuditInterceptor.savingChanges() ──────────────────────────────────────

describe('AuditInterceptor implements ISaveChangesInterceptor', () => {
  function makeMeta(columns: string[]) {
    return { columns: columns.map((propertyName) => ({ propertyName })) };
  }

  it('savingChanges() applies audit fields to added entries', () => {
    const fixedNow = new Date('2025-01-01T00:00:00Z');
    const interceptor = new AuditInterceptor(
      {
        enabled: true,
        clock: () => fixedNow,
        getCurrentUser: () => 'alice'
      },
      () => makeMeta(['createdAt', 'updatedAt', 'createdBy', 'updatedBy'])
    );

    const entity: Record<string, unknown> = {};
    const EntityClass = class {};
    const ev: SaveChangesEventData = {
      entityCount: 1,
      entries: [{ entity, entityClass: EntityClass, state: 'added' }]
    };

    const result = interceptor.savingChanges(ev, InterceptionResult.NoResult<number>());

    expect(result.isSuppressed).toBe(false);
    expect(entity['createdAt']).toBe(fixedNow);
    expect(entity['updatedAt']).toBe(fixedNow);
    expect(entity['createdBy']).toBe('alice');
    expect(entity['updatedBy']).toBe('alice');
  });

  it('savingChanges() is a pass-through when audit disabled', () => {
    const interceptor = new AuditInterceptor({ enabled: false }, () => makeMeta(['createdAt']));
    const entity: Record<string, unknown> = {};
    const ev: SaveChangesEventData = {
      entityCount: 1,
      entries: [{ entity, entityClass: class {}, state: 'added' }]
    };
    const noResult = InterceptionResult.NoResult<number>();
    const result = interceptor.savingChanges(ev, noResult);
    expect(result).toBe(noResult);
    expect(entity).toEqual({});
  });

  it('savingChanges() handles empty entries gracefully', () => {
    const interceptor = new AuditInterceptor({ enabled: true }, () => makeMeta(['createdAt']));
    const ev: SaveChangesEventData = { entityCount: 0, entries: [] };
    expect(() =>
      interceptor.savingChanges(ev, InterceptionResult.NoResult<number>())
    ).not.toThrow();
  });

  it('savingChanges() applies only updatedAt for modified entries (no createdAt)', () => {
    const fixedNow = new Date('2025-06-01T00:00:00Z');
    const interceptor = new AuditInterceptor({ enabled: true, clock: () => fixedNow }, () =>
      makeMeta(['createdAt', 'updatedAt'])
    );

    const entity: Record<string, unknown> = { createdAt: new Date('2024-01-01') };
    const original = entity['createdAt'] as Date;
    const ev: SaveChangesEventData = {
      entityCount: 1,
      entries: [{ entity, entityClass: class {}, state: 'modified' }]
    };

    interceptor.savingChanges(ev, InterceptionResult.NoResult<number>());

    // createdAt must not be overwritten on modified
    expect(entity['createdAt']).toBe(original);
    expect(entity['updatedAt']).toBe(fixedNow);
  });
});
