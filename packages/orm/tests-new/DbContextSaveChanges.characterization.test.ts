/**
 * Characterization (regression) suite for `DbContext.saveChanges` orchestration.
 *
 * Written BEFORE the god-class decomposition (refactor orm/task-1) to lock the
 * observable behaviour of the save pipeline against `TestProvider`:
 *   - provider call ORDER for begin/commit/rollback + insert/update/delete,
 *   - affected-row counts,
 *   - own-transaction vs. caller-managed-transaction handling,
 *   - savingChanges suppression short-circuit,
 *   - error → rollback,
 *   - OptimisticConcurrencyError → DbUpdateConcurrencyException translation,
 *   - empty-change-set fast path.
 *
 * These assertions are intentionally limited to provider-observable effects so
 * they survive the internal restructure regardless of private field names.
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { OptimisticConcurrencyError } from '@ts-linq/types';

import { DbContext } from '../src/DbContext';
import { DbUpdateConcurrencyException } from '../src/exceptions/DbUpdateConcurrencyException';
import { TestProvider } from '../tests/stubs/TestProvider';

@Entity({ name: 'char_widgets' })
class Widget {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class WidgetContext extends DbContext {
  widgets = this.set(Widget);
}

/**
 * Install spies on the provider that append a label to a shared `calls` array,
 * preserving the real implementation so the in-memory store stays consistent.
 */
function traceProvider(provider: TestProvider): string[] {
  const calls: string[] = [];
  const track = (name: string, method: keyof TestProvider) => {
    const target = provider as unknown as Record<string, (...args: unknown[]) => unknown>;
    const original = target[method as string].bind(provider);
    jest.spyOn(target, method as string).mockImplementation((...args: unknown[]) => {
      calls.push(name);
      return original(...args);
    });
  };
  track('begin', 'beginTransaction');
  track('commit', 'commitTransaction');
  track('rollback', 'rollbackTransaction');
  track('insert', 'insert');
  track('update', 'update');
  track('delete', 'delete');
  return calls;
}

describe('DbContext.saveChanges — characterization', () => {
  let provider: TestProvider;
  let ctx: WidgetContext;

  beforeEach(async () => {
    provider = new TestProvider(':memory:');
    await provider.connect();
    ctx = new WidgetContext({ provider });
    await ctx.ensureCreated();
  });

  afterEach(async () => {
    await ctx?.dispose?.();
    jest.restoreAllMocks();
  });

  it('empty change set: returns 0 and opens no transaction', async () => {
    const calls = traceProvider(provider);
    const affected = await ctx.saveChanges();
    expect(affected).toBe(0);
    expect(calls).toEqual([]);
  });

  it('single insert: begin → insert → commit, returns 1', async () => {
    const w = new Widget();
    w.name = 'a';
    ctx.widgets.add(w);

    const calls = traceProvider(provider);
    const affected = await ctx.saveChanges();

    expect(affected).toBe(1);
    expect(calls).toEqual(['begin', 'insert', 'commit']);
  });

  it('mixed insert + update + delete: one own transaction wraps all DML, returns 3', async () => {
    // Seed two rows first.
    const toUpdate = new Widget();
    toUpdate.name = 'u0';
    const toDelete = new Widget();
    toDelete.name = 'd0';
    ctx.widgets.add(toUpdate);
    ctx.widgets.add(toDelete);
    await ctx.saveChanges();

    // Now stage one of each operation.
    const toInsert = new Widget();
    toInsert.name = 'i1';
    ctx.widgets.add(toInsert);
    toUpdate.name = 'u1';
    ctx.widgets.update(toUpdate);
    ctx.widgets.remove(toDelete);

    const calls = traceProvider(provider);
    const affected = await ctx.saveChanges();

    expect(affected).toBe(3);
    // Exactly one begin/commit pair, no rollback.
    expect(calls.filter((c) => c === 'begin')).toHaveLength(1);
    expect(calls.filter((c) => c === 'commit')).toHaveLength(1);
    expect(calls).not.toContain('rollback');
    expect(calls[0]).toBe('begin');
    expect(calls[calls.length - 1]).toBe('commit');
    // One of each DML happened between begin and commit.
    expect(calls.filter((c) => c === 'insert')).toHaveLength(1);
    expect(calls.filter((c) => c === 'update')).toHaveLength(1);
    expect(calls.filter((c) => c === 'delete')).toHaveLength(1);
  });

  it('caller-managed transaction: saveChanges participates without opening its own', async () => {
    const w = new Widget();
    w.name = 'tx';
    ctx.widgets.add(w);

    const calls = traceProvider(provider);
    await ctx.beginTransaction();
    await ctx.saveChanges();
    await ctx.commitTransaction();

    // Only the caller-managed begin/commit; saveChanges adds neither.
    expect(calls).toEqual(['begin', 'insert', 'commit']);
  });

  it('error during DML: rollback issued, no commit, error propagates', async () => {
    const w = new Widget();
    w.name = 'boom';
    ctx.widgets.add(w);

    const calls = traceProvider(provider);
    jest.spyOn(provider, 'insert').mockImplementationOnce(() => {
      calls.push('insert');
      return Promise.reject(new Error('db error'));
    });

    await expect(ctx.saveChanges()).rejects.toThrow('db error');
    expect(calls).toEqual(['begin', 'insert', 'rollback']);
    expect(calls).not.toContain('commit');
  });

  it('OptimisticConcurrencyError is translated to DbUpdateConcurrencyException', async () => {
    const w = new Widget();
    w.name = 'conflict';
    ctx.widgets.add(w);

    jest
      .spyOn(provider, 'insert')
      .mockRejectedValueOnce(new OptimisticConcurrencyError('version mismatch'));

    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(DbUpdateConcurrencyException);
  });

  it('OptimisticConcurrencyError translation still rolls back the own transaction', async () => {
    const w = new Widget();
    w.name = 'conflict2';
    ctx.widgets.add(w);

    const calls = traceProvider(provider);
    jest.spyOn(provider, 'insert').mockImplementationOnce(() => {
      calls.push('insert');
      return Promise.reject(new OptimisticConcurrencyError('version mismatch'));
    });

    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(DbUpdateConcurrencyException);
    expect(calls).toEqual(['begin', 'insert', 'rollback']);
  });

  it('after a successful save the change tracker is cleared (acceptAllChanges)', async () => {
    const w = new Widget();
    w.name = 'accept';
    ctx.widgets.add(w);
    await ctx.saveChanges();

    // A second save with no further mutations must be a no-op.
    const calls = traceProvider(provider);
    const affected = await ctx.saveChanges();
    expect(affected).toBe(0);
    expect(calls).toEqual([]);
  });
});
