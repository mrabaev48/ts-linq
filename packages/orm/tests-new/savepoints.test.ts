import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { DbContextOptionsBuilder } from '../src/DbContextOptionsBuilder';
import { DbContextTransaction } from '../src/transactions/DbContextTransaction';
import { TestProvider } from '../tests/stubs/TestProvider';

@Entity()
class SpItem {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class SpContext extends DbContext {}

describe('DbContextTransaction — savepoints and beginTransactionAsync', () => {
  let provider: TestProvider;
  let ctx: SpContext;

  beforeEach(async () => {
    provider = new TestProvider(':memory:');
    await provider.connect();
    ctx = new SpContext({ provider });
    await ctx.ensureCreated();
  });

  afterEach(async () => {
    await ctx.dispose();
    await provider.disconnect();
    jest.restoreAllMocks();
  });

  it('beginTransactionAsync returns a DbContextTransaction', async () => {
    const tx = await ctx.database.beginTransactionAsync();
    expect(tx).toBeInstanceOf(DbContextTransaction);
    await tx.rollbackAsync();
  });

  it('beginTransactionAsync opens a real provider transaction', async () => {
    const beginSpy = jest.spyOn(provider, 'beginTransaction');
    const tx = await ctx.database.beginTransactionAsync();
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(ctx.isInTransaction).toBe(true);
    await tx.rollbackAsync();
  });

  it('commitAsync commits the transaction', async () => {
    const commitSpy = jest.spyOn(provider, 'commitTransaction');
    const tx = await ctx.database.beginTransactionAsync();
    await tx.commitAsync();
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(ctx.isInTransaction).toBe(false);
  });

  it('rollbackAsync rolls back the transaction', async () => {
    const rollbackSpy = jest.spyOn(provider, 'rollbackTransaction');
    const tx = await ctx.database.beginTransactionAsync();
    await tx.rollbackAsync();
    expect(rollbackSpy).toHaveBeenCalledTimes(1);
    expect(ctx.isInTransaction).toBe(false);
  });

  it('double-dispose is safe — rollback is only called once', async () => {
    const rollbackSpy = jest.spyOn(provider, 'rollbackTransaction');
    const tx = await ctx.database.beginTransactionAsync();
    await tx.rollbackAsync();
    await tx.rollbackAsync(); // second call is ignored
    expect(rollbackSpy).toHaveBeenCalledTimes(1);
  });

  it('commitAsync after rollbackAsync is ignored', async () => {
    const commitSpy = jest.spyOn(provider, 'commitTransaction');
    const tx = await ctx.database.beginTransactionAsync();
    await tx.rollbackAsync();
    await tx.commitAsync(); // should be ignored
    expect(commitSpy).toHaveBeenCalledTimes(0);
  });

  it('createSavepointAsync forwards to provider.createSavepoint', async () => {
    const spSpy = jest.spyOn(provider, 'createSavepoint');
    const tx = await ctx.database.beginTransactionAsync();
    await tx.createSavepointAsync('sp1');
    expect(spSpy).toHaveBeenCalledWith('sp1');
    await tx.rollbackAsync();
  });

  it('rollbackToSavepointAsync forwards to provider.rollbackToSavepoint', async () => {
    const spSpy = jest.spyOn(provider, 'rollbackToSavepoint');
    const tx = await ctx.database.beginTransactionAsync();
    await tx.createSavepointAsync('sp1');
    await tx.rollbackToSavepointAsync('sp1');
    expect(spSpy).toHaveBeenCalledWith('sp1');
    await tx.rollbackAsync();
  });

  it('releaseSavepointAsync forwards to provider.releaseSavepoint', async () => {
    const spSpy = jest.spyOn(provider, 'releaseSavepoint');
    const tx = await ctx.database.beginTransactionAsync();
    await tx.createSavepointAsync('sp1');
    await tx.releaseSavepointAsync('sp1');
    expect(spSpy).toHaveBeenCalledWith('sp1');
    await tx.rollbackAsync();
  });

  it('nested savepoints: multiple savepoints within one transaction', async () => {
    const createSpy = jest.spyOn(provider, 'createSavepoint');
    const rollbackSpSpy = jest.spyOn(provider, 'rollbackToSavepoint');

    const tx = await ctx.database.beginTransactionAsync();
    await tx.createSavepointAsync('outer');
    await tx.createSavepointAsync('inner');
    await tx.rollbackToSavepointAsync('inner');
    await tx.releaseSavepointAsync('inner');
    await tx.commitAsync();

    expect(createSpy).toHaveBeenCalledWith('outer');
    expect(createSpy).toHaveBeenCalledWith('inner');
    expect(rollbackSpSpy).toHaveBeenCalledWith('inner');
  });

  it('[Symbol.asyncDispose] auto-rolls-back uncommitted transaction', async () => {
    const rollbackSpy = jest.spyOn(provider, 'rollbackTransaction');
    const tx = await ctx.database.beginTransactionAsync();
    // Simulate await-using scope exit without explicit commit/rollback
    await tx[Symbol.asyncDispose]();
    expect(rollbackSpy).toHaveBeenCalledTimes(1);
    expect(ctx.isInTransaction).toBe(false);
  });

  it('[Symbol.asyncDispose] is a no-op on already-committed transaction', async () => {
    const rollbackSpy = jest.spyOn(provider, 'rollbackTransaction');
    const tx = await ctx.database.beginTransactionAsync();
    await tx.commitAsync();
    await tx[Symbol.asyncDispose](); // already disposed — rollback should NOT be called
    expect(rollbackSpy).toHaveBeenCalledTimes(0);
  });
});

describe('createExecutionStrategy and enableRetryOnFailure', () => {
  it('createExecutionStrategy() returns an ExecutionStrategy with defaults', async () => {
    const provider = new TestProvider(':memory:');
    await provider.connect();
    const ctx = new SpContext({ provider });
    const strategy = ctx.database.createExecutionStrategy();
    expect(strategy).toBeDefined();
    expect(typeof strategy.executeAsync).toBe('function');
    await ctx.dispose();
  });

  it('enableRetryOnFailure options flow into createExecutionStrategy', async () => {
    const provider = new TestProvider(':memory:');
    await provider.connect();
    const opts = new DbContextOptionsBuilder({ provider })
      .enableRetryOnFailure({ maxRetryCount: 5, maxRetryDelay: 10_000 })
      .build();
    const ctx = new SpContext(opts);
    const strategy = ctx.database.createExecutionStrategy();
    expect(strategy).toBeDefined();

    // Strategy should succeed immediately when operation succeeds
    let called = 0;
    const result = await strategy.executeAsync(async () => {
      called++;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(called).toBe(1);
    await ctx.dispose();
  });

  it('strategy retries on transient errors from provider', async () => {
    const provider = new TestProvider(':memory:');
    await provider.connect();

    // Make the provider's checkTransientError return true for specific errors
    jest.spyOn(provider, 'checkTransientError').mockReturnValue(true);

    const opts = new DbContextOptionsBuilder({ provider })
      .enableRetryOnFailure({ maxRetryCount: 3, maxRetryDelay: 100 })
      .build();
    const ctx = new SpContext(opts);
    const strategy = ctx.database.createExecutionStrategy();

    let calls = 0;
    const result = await strategy.executeAsync(async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
      return 'succeeded';
    });

    expect(result).toBe('succeeded');
    expect(calls).toBe(2);

    jest.restoreAllMocks();
    await ctx.dispose();
  });
});
