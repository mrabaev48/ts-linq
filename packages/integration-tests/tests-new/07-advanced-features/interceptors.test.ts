import 'reflect-metadata';

import {
  InterceptionResult,
  type ISaveChangesInterceptor,
  type SaveChangesEventData
} from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, DbContextOptionsBuilder } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

// ── Fixtures ──────────────────────────────────────────────────────────────────

@Entity({ name: 'ic_items' })
class IcItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  tag!: string;
}

class IcContext extends DbContext {
  items = this.set(IcItem);
}

function makeCtx(interceptors: object[]): { ctx: IcContext; provider: TestProvider } {
  const provider = new TestProvider(':memory:');
  const opts = new DbContextOptionsBuilder({ provider }).addInterceptors(...interceptors).build();
  const ctx = new IcContext(opts);
  return { ctx, provider };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Advanced Features - ISaveChangesInterceptor pipeline', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('savingChanges() receives entries before DML executes', async () => {
    let capturedEntries: SaveChangesEventData['entries'] = [];
    let insertCallCount = 0;

    const ic: ISaveChangesInterceptor = {
      savingChanges(ev: SaveChangesEventData, result: InterceptionResult<number>) {
        capturedEntries = ev.entries ?? [];
        return result;
      }
    };

    const { ctx, provider } = makeCtx([ic]);
    await ctx.ensureCreated();

    // Spy to verify insert runs AFTER savingChanges
    const origInsert = provider.insert.bind(provider);
    jest.spyOn(provider, 'insert').mockImplementation(async (...args) => {
      insertCallCount++;
      return origInsert(...args);
    });

    const item = new IcItem();
    item.name = 'hello';
    ctx.items.add(item);
    await ctx.saveChanges();

    // savingChanges captured the entry
    expect(capturedEntries).toHaveLength(1);
    expect(capturedEntries[0].state).toBe('added');
    // DML executed after interception
    expect(insertCallCount).toBe(1);

    await ctx.dispose();
  });

  it('savedChanges() is called after successful DML', async () => {
    let savedEventData: SaveChangesEventData | undefined;
    let savedRowCount: number | undefined;

    const ic: ISaveChangesInterceptor = {
      savedChanges(ev: SaveChangesEventData, result: number) {
        savedEventData = ev;
        savedRowCount = result;
        return result;
      }
    };

    const { ctx } = makeCtx([ic]);
    await ctx.ensureCreated();

    const item = new IcItem();
    item.name = 'world';
    ctx.items.add(item);
    await ctx.saveChanges();

    expect(savedEventData).toBeDefined();
    expect(savedRowCount).toBeGreaterThan(0);

    await ctx.dispose();
  });

  it('saveChangesFailed() is called when an error is thrown during DML', async () => {
    let failedError: Error | undefined;

    const ic: ISaveChangesInterceptor = {
      saveChangesFailed(_ev: SaveChangesEventData, err: Error): void {
        failedError = err;
      }
    };

    const { ctx, provider } = makeCtx([ic]);
    await ctx.ensureCreated();

    jest.spyOn(provider, 'insert').mockRejectedValueOnce(new Error('simulated DB failure'));

    const item = new IcItem();
    item.name = 'crash';
    ctx.items.add(item);

    await expect(ctx.saveChanges()).rejects.toThrow('simulated DB failure');
    expect(failedError?.message).toBe('simulated DB failure');

    await ctx.dispose();
  });

  it('SuppressWithResult prevents DML from executing', async () => {
    const ic: ISaveChangesInterceptor = {
      savingChanges(
        _ev: SaveChangesEventData,
        _result: InterceptionResult<number>
      ): InterceptionResult<number> {
        return InterceptionResult.SuppressWithResult<number>(0);
      }
    };

    const { ctx, provider } = makeCtx([ic]);
    await ctx.ensureCreated();

    const insertSpy = jest.spyOn(provider, 'insert');

    const item = new IcItem();
    item.name = 'suppressed';
    ctx.items.add(item);

    const result = await ctx.saveChanges();

    expect(result).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();

    await ctx.dispose();
  });

  it('multiple interceptors execute in registration order', async () => {
    const order: string[] = [];

    const ic1: ISaveChangesInterceptor = {
      savingChanges(ev: SaveChangesEventData, result: InterceptionResult<number>) {
        order.push('ic1:savingChanges');
        return result;
      },
      savedChanges(ev: SaveChangesEventData, result: number) {
        order.push('ic1:savedChanges');
        return result;
      }
    };

    const ic2: ISaveChangesInterceptor = {
      savingChanges(ev: SaveChangesEventData, result: InterceptionResult<number>) {
        order.push('ic2:savingChanges');
        return result;
      },
      savedChanges(ev: SaveChangesEventData, result: number) {
        order.push('ic2:savedChanges');
        return result;
      }
    };

    const { ctx } = makeCtx([ic1, ic2]);
    await ctx.ensureCreated();

    const item = new IcItem();
    item.name = 'ordered';
    ctx.items.add(item);
    await ctx.saveChanges();

    expect(order).toEqual([
      'ic1:savingChanges',
      'ic2:savingChanges',
      'ic1:savedChanges',
      'ic2:savedChanges'
    ]);

    await ctx.dispose();
  });

  it('addInterceptors() via DbContextOptionsBuilder registers interceptors correctly', async () => {
    const log: string[] = [];

    const ic: ISaveChangesInterceptor = {
      savingChanges(ev: SaveChangesEventData, result: InterceptionResult<number>) {
        log.push(`saving:${ev.entityCount}`);
        return result;
      },
      savedChanges(ev: SaveChangesEventData, result: number) {
        log.push(`saved:${result}`);
        return result;
      }
    };

    const provider = new TestProvider(':memory:');
    const opts = new DbContextOptionsBuilder({ provider }).addInterceptors(ic).build();

    const ctx = new IcContext(opts);
    await ctx.ensureCreated();

    ctx.items.add(Object.assign(new IcItem(), { name: 'a' }));
    ctx.items.add(Object.assign(new IcItem(), { name: 'b' }));
    await ctx.saveChanges();

    expect(log[0]).toBe('saving:2');
    expect(log[1]).toMatch(/^saved:/);

    await ctx.dispose();
  });
});
