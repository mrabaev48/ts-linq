import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'sp_accounts' })
class SpAccount {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'number' })
  balance!: number;
}

class SpDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))('E2E Savepoints - %s', (providerName) => {
  let harness: any;
  let provider: any;
  let context: SpDbContext;

  beforeEach(async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    ({ harness, provider } = await setupTestDatabase(providerName as any));
    context = new SpDbContext({ provider });
    await context.ensureCreated();
  });

  afterEach(async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    await dropTables(provider, ['sp_accounts']);
    await context.dispose();
    await teardownTestDatabase(harness);
  });

  it('beginTransactionAsync returns a transaction object', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const tx = await context.database.beginTransactionAsync();
    expect(tx).toBeDefined();
    expect(typeof tx.createSavepointAsync).toBe('function');
    expect(typeof tx.rollbackToSavepointAsync).toBe('function');
    expect(typeof tx.releaseSavepointAsync).toBe('function');
    expect(typeof tx.commitAsync).toBe('function');
    expect(typeof tx.rollbackAsync).toBe('function');
    await tx.rollbackAsync();
  });

  it('createSavepoint and releaseSavepoint work within a transaction', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const accountSet = context.set(SpAccount);

    const tx = await context.database.beginTransactionAsync();
    try {
      const a = new SpAccount();
      a.name = 'Alice';
      a.balance = 1000;
      accountSet.add(a);
      await context.saveChanges();

      await tx.createSavepointAsync('after_alice');
      await tx.releaseSavepointAsync('after_alice');
      await tx.commitAsync();
    } catch {
      await tx.rollbackAsync();
      throw new Error('test failed');
    }

    const accounts = await accountSet.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Alice');
  });

  it('rollbackToSavepoint reverts partial work without aborting the transaction', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const accountSet = context.set(SpAccount);

    const tx = await context.database.beginTransactionAsync();
    try {
      // Insert safe data
      const alice = new SpAccount();
      alice.name = 'Alice';
      alice.balance = 500;
      accountSet.add(alice);
      await context.saveChanges();

      // Create savepoint before risky work
      await tx.createSavepointAsync('before_risky');

      // Risky work
      const risky = new SpAccount();
      risky.name = 'Risky';
      risky.balance = 999;
      accountSet.add(risky);
      await context.saveChanges();

      // Simulate failure — roll back to savepoint
      await tx.rollbackToSavepointAsync('before_risky');

      // Commit only the safe work
      await tx.commitAsync();
    } catch {
      await tx.rollbackAsync();
      throw new Error('test failed');
    }

    const accounts = await accountSet.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Alice');
  });

  it('createExecutionStrategy returns a strategy that can execute operations', async () => {
    if (process.env.SKIP_DB_TESTS === '1') return;
    const strategy = context.database.createExecutionStrategy();
    expect(strategy).toBeDefined();

    const accountSet = context.set(SpAccount);
    await strategy.executeAsync(async () => {
      const tx = await context.database.beginTransactionAsync();
      try {
        const bob = new SpAccount();
        bob.name = 'Bob';
        bob.balance = 300;
        accountSet.add(bob);
        await context.saveChanges();
        await tx.commitAsync();
      } catch {
        await tx.rollbackAsync();
        throw new Error('inner error');
      }
    });

    const accounts = await accountSet.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Bob');
  });
});
