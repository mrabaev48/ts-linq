import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { TestProvider } from '../tests/stubs/TestProvider';

@Entity()
class TxItem {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class TxContext extends DbContext {}

describe('DbContext — transaction depth tracking (ISSUE-018)', () => {
  let provider: TestProvider;
  let ctx: TxContext;

  beforeEach(async () => {
    provider = new TestProvider(':memory:');
    await provider.connect();
    ctx = new TxContext({ provider: provider });
    await ctx.ensureCreated();
  });

  afterEach(async () => {
    await ctx.dispose();
    await provider.disconnect();
    jest.restoreAllMocks();
  });

  it('isInTransaction is false initially', () => {
    expect(ctx.isInTransaction).toBe(false);
  });

  it('isInTransaction transitions correctly through beginTransaction / commitTransaction', async () => {
    expect(ctx.isInTransaction).toBe(false);
    await ctx.beginTransaction();
    expect(ctx.isInTransaction).toBe(true);
    await ctx.commitTransaction();
    expect(ctx.isInTransaction).toBe(false);
  });

  it('rollbackTransaction resets depth — isInTransaction becomes false', async () => {
    await ctx.beginTransaction();
    expect(ctx.isInTransaction).toBe(true);
    await ctx.rollbackTransaction();
    expect(ctx.isInTransaction).toBe(false);
  });

  it('saveChanges() without prior transaction opens and closes its own transaction', async () => {
    const beginSpy = jest.spyOn(provider, 'beginTransaction');
    const commitSpy = jest.spyOn(provider, 'commitTransaction');

    const item = new TxItem();
    item.name = 'solo';
    ctx.set(TxItem).add(item);
    const affected = await ctx.saveChanges();

    expect(affected).toBeGreaterThanOrEqual(1);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).toHaveBeenCalledTimes(1);
    // transaction was closed by saveChanges itself
    expect(provider.inTransactionState).toBe(false);
    expect(ctx.isInTransaction).toBe(false);
  });

  it('saveChanges() inside beginTransaction does NOT open a nested transaction', async () => {
    const beginSpy = jest.spyOn(provider, 'beginTransaction');
    const commitSpy = jest.spyOn(provider, 'commitTransaction');

    await ctx.beginTransaction(); // caller opens transaction

    const item = new TxItem();
    item.name = 'inside-tx';
    ctx.set(TxItem).add(item);
    const affected = await ctx.saveChanges(); // must NOT call beginTransaction again

    expect(affected).toBeGreaterThanOrEqual(1);
    // beginTransaction called exactly once — from ctx.beginTransaction(), NOT from saveChanges()
    expect(beginSpy).toHaveBeenCalledTimes(1);
    // commitTransaction not called yet — caller owns it
    expect(commitSpy).toHaveBeenCalledTimes(0);
    expect(ctx.isInTransaction).toBe(true);

    await ctx.commitTransaction();
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(ctx.isInTransaction).toBe(false);
  });

  it('multiple saveChanges() within one transaction use a single begin/commit pair', async () => {
    const beginSpy = jest.spyOn(provider, 'beginTransaction');
    const commitSpy = jest.spyOn(provider, 'commitTransaction');

    await ctx.beginTransaction();

    const item1 = new TxItem();
    item1.name = 'first';
    ctx.set(TxItem).add(item1);
    const r1 = await ctx.saveChanges();

    const item2 = new TxItem();
    item2.name = 'second';
    ctx.set(TxItem).add(item2);
    const r2 = await ctx.saveChanges();

    await ctx.commitTransaction();

    expect(r1).toBeGreaterThanOrEqual(1);
    expect(r2).toBeGreaterThanOrEqual(1);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(provider.inTransactionState).toBe(false);
    expect(ctx.isInTransaction).toBe(false);
  });

  it('error in saveChanges within caller transaction does NOT call provider.rollbackTransaction', async () => {
    const rollbackSpy = jest.spyOn(provider, 'rollbackTransaction');

    await ctx.beginTransaction();

    // Force insert to fail so saveChanges throws
    jest.spyOn(provider, 'insert').mockRejectedValueOnce(new Error('simulated insert error'));

    const item = new TxItem();
    item.name = 'will-fail';
    ctx.set(TxItem).add(item);

    await expect(ctx.saveChanges()).rejects.toThrow('simulated insert error');

    // saveChanges must NOT call rollback — the caller owns the transaction
    expect(rollbackSpy).toHaveBeenCalledTimes(0);
    expect(ctx.isInTransaction).toBe(true);

    // caller cleans up
    await ctx.rollbackTransaction();
    expect(ctx.isInTransaction).toBe(false);
  });
});
