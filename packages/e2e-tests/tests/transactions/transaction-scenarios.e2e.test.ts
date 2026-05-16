import { setupTestDatabase, teardownTestDatabase } from '../../src/setup';
import { Entity, Column, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

@Entity({ name: 'accounts' })
class Account {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column()
  balance!: number;
}

class TestDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run ? describe.each(['postgresql']) : describe.skip.each(['postgresql']))('E2E Transactions - %s', (providerName) => {
  let harness: any;
  let provider: any;
  let context: TestDbContext;

  beforeEach(async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }
    ({ harness, provider } = await setupTestDatabase(providerName as any));
    context = new TestDbContext({ provider });
    await context.ensureCreated();
  });

  afterEach(async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }
    await (context as any)?.dropDatabase?.();
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

    const accounts = await accountSet.query().toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].balance).toBe(1000);
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

    const accounts = await accountSet.query().toArray();
    expect(accounts).toHaveLength(0);
  });

  it('should handle nested transactions', async () => {
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
    
    await context.beginTransaction();
    
    const account2 = new Account();
    account2.name = 'Account 2';
    account2.balance = 200;
    accountSet.add(account2);
    await context.saveChanges();
    
    await context.commitTransaction();
    await context.commitTransaction();

    const accounts = await accountSet.query().toArray();
    expect(accounts).toHaveLength(2);
  });

  it('should perform atomic money transfer', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const accountSet = context.set(Account);
    
    // Create accounts
    const account1 = new Account();
    account1.name = 'Alice';
    account1.balance = 1000;
    accountSet.add(account1);

    const account2 = new Account();
    account2.name = 'Bob';
    account2.balance = 500;
    accountSet.add(account2);
    
    await context.saveChanges();

    // Transfer money
    await context.beginTransaction();
    
    account1.balance -= 100;
    account2.balance += 100;
    
    accountSet.update(account1);
    accountSet.update(account2);
    await context.saveChanges();
    
    await context.commitTransaction();

    const accounts = await accountSet.query().toArray();
    const alice = accounts.find(a => a.name === 'Alice');
    const bob = accounts.find(a => a.name === 'Bob');
    
    expect(alice?.balance).toBe(900);
    expect(bob?.balance).toBe(600);
  });
});
