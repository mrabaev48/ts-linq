import { setupTestDatabase, teardownTestDatabase, TestHarness } from '../setup';
import { Entity, Column, PrimaryKey, MetadataStorage } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import type { DatabaseProvider } from '@ts-linq/core';

@Entity({ name: 'accounts' })
class Account {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column()
  balance!: number;
}

class TestDbContext extends DbContext {
  constructor(provider: DatabaseProvider) {
    super({ provider });
  }
}

describe.each(['postgres'] as const)('E2E Transactions - %s', (providerName) => {
  let harness: TestHarness;
  let provider: DatabaseProvider;
  let context: TestDbContext;

  beforeEach(async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }
    ({ harness, provider } = await setupTestDatabase(providerName));
    context = new TestDbContext(provider);
    const accountMeta = MetadataStorage.getEntity(Account);
    if (accountMeta) await provider.createTable(accountMeta);
  });

  afterEach(async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }
    try {
      await provider.executeQuery('DROP TABLE IF EXISTS accounts', []);
    } catch { /* ignore */ }
    await teardownTestDatabase(harness);
  });

  it('should commit transaction successfully', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const accountSet = context.set(Account);
    
    await context.beginTransaction();
    
    const account = new Account();
    account.name = 'Savings';
    account.balance = 1000;
    accountSet.add(account);
    await context.saveChanges();
    
    await context.commitTransaction();

    const accounts = await accountSet.toArray();
    expect(accounts).toHaveLength(1);
    expect(Number(accounts[0].balance)).toBe(1000);
  });

  it('should rollback transaction on error', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const accountSet = context.set(Account);
    
    await context.beginTransaction();
    
    const account = new Account();
    account.name = 'Checking';
    account.balance = 500;
    accountSet.add(account);
    await context.saveChanges();
    
    await context.rollbackTransaction();

    const accounts = await accountSet.toArray();
    expect(accounts).toHaveLength(0);
  });

  it.skip('should handle nested transactions', async () => {
    // PostgreSQL doesn't support true nested transactions, only savepoints
    // This test is skipped until savepoint support is added
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const accountSet = context.set(Account);
    
    await context.beginTransaction();
    
    const account1 = new Account();
    account1.name = 'Account 1';
    account1.balance = 100;
    accountSet.add(account1);
    await context.saveChanges();
    
    await context.commitTransaction();

    const accounts = await accountSet.toArray();
    expect(accounts).toHaveLength(1);
  });

  it('should perform atomic money transfer', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const accountSet = context.set(Account);
    
    const account1 = new Account();
    account1.name = 'Alice';
    account1.balance = 1000;
    accountSet.add(account1);

    const account2 = new Account();
    account2.name = 'Bob';
    account2.balance = 500;
    accountSet.add(account2);
    
    await context.saveChanges();

    await context.beginTransaction();
    
    account1.balance = Number(account1.balance) - 100;
    account2.balance = Number(account2.balance) + 100;
    
    accountSet.update(account1);
    accountSet.update(account2);
    await context.saveChanges();
    
    await context.commitTransaction();

    const accounts = await accountSet.toArray();
    const alice = accounts.find((a: Account) => a.name === 'Alice');
    const bob = accounts.find((a: Account) => a.name === 'Bob');
    
    expect(Number(alice?.balance)).toBe(900);
    expect(Number(bob?.balance)).toBe(600);
  });
});
