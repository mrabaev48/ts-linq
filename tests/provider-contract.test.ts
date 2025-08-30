import 'reflect-metadata';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

@Entity({ name: 'C_Users' })
class CUser { @PrimaryKey({ autoIncrement: true }) id!: number; @Column({ type: 'TEXT', nullable: false }) name!: string; }

describe('Provider contract (SQLite)', () => {
  let provider: SQLiteProvider;

  beforeEach(async () => {
    // Ensure decorators ran
    new CUser();
    provider = new SQLiteProvider(':memory:');
    await provider.connect();
    const meta = MetadataStorage.getEntity(CUser);
    expect(meta).toBeDefined();
    await provider.createTable(meta!);
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  test('CRUD: insert, findAll, update, delete', async () => {
    const u = new CUser();
    u.name = 'A';
    await provider.insert(u, CUser);
    expect(u.id).toBeGreaterThan(0);

    let all = await provider.findAll(CUser);
    expect(all.length).toBe(1);

    const first = all[0];
    (first as any).name = 'B';
    await provider.update(first, CUser);

    all = await provider.findWhere(CUser, { name: 'B' });
    expect(all.length).toBe(1);

    await provider.delete(first, CUser);
    all = await provider.findAll(CUser);
    expect(all.length).toBe(0);
  });

  test('Transactions: begin/commit/rollback state flags', async () => {
    expect(provider.inTransactionState).toBe(false);
    await provider.beginTransaction();
    expect(provider.inTransactionState).toBe(true);
    await provider.commitTransaction();
    expect(provider.inTransactionState).toBe(false);
    await provider.beginTransaction();
    expect(provider.inTransactionState).toBe(true);
    await provider.rollbackTransaction();
    expect(provider.inTransactionState).toBe(false);
  });
});


