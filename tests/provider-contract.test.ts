import 'reflect-metadata';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { OptimisticConcurrencyError } from '../src/types';
import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

@Entity({ name: 'C_Users' })
class CUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

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

  test('Upsert: insert then update on conflict', async () => {
    const u = new CUser();
    u.name = 'A';
    // first insert via upsert
    await provider.upsert(u, CUser);
    expect(u.id).toBeGreaterThan(0);

    // change and upsert should update
    u.name = 'B';
    await provider.upsert(u, CUser);
    const all = await provider.findWhere(CUser, { name: 'B' });
    expect(all.length).toBe(1);
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

  test('Optimistic concurrency error type', async () => {
    const u = new CUser();
    u.name = 'A';
    await provider.insert(u, CUser);
    // prepare stale entity with wrong version by enabling version metadata retroactively
    const meta = MetadataStorage.getEntity(CUser)!;
    meta.columns.push({
      propertyName: 'version',
      columnName: 'version',
      type: 'INTEGER',
      nullable: false,
      isGenerated: false,
      isVersion: true
    } as any);
    await provider.executeNonQuery(
      `ALTER TABLE ${meta.tableName} ADD COLUMN version INTEGER DEFAULT 0`
    );
    // stale update with version=5 that doesn't match 0
    (u as any).version = 5;
    await expect(provider.update(u, CUser)).rejects.toBeInstanceOf(OptimisticConcurrencyError);
  });
});
