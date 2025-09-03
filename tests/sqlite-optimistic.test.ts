import 'reflect-metadata';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { OptimisticConcurrencyError } from '../src/types';
import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

@Entity({ name: 'VItems' })
class VItem {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'INTEGER', nullable: false }) version!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

describe('SQLite optimistic concurrency', () => {
  let provider: SQLiteProvider;
  beforeEach(async () => {
    new VItem();
    // mark version column in metadata
    const meta = MetadataStorage.getEntity(VItem)!;
    const vcol = meta.columns.find((c) => c.propertyName === 'version');
    if (vcol) (vcol as any).isVersion = true;
    provider = new SQLiteProvider(':memory:');
    await provider.connect();
    await provider.createTable(meta);
  });
  afterEach(async () => {
    await provider.disconnect();
  });

  test('increments version on update and enforces match', async () => {
    const item = new VItem();
    item.name = 'A';
    item.version = 0;
    await provider.insert(item, VItem);
    // emulate DB-generated id by re-read
    const all = await provider.findAll(VItem);
    const created = all[0];
    expect((created as any).version ?? 0).toBe(0);

    // Set version explicitly then update
    item.id = (created as any).id;
    item.version = 0;
    item.name = 'B';
    const updated = await provider.update(item, VItem);
    expect((updated as any).version).toBe(1);

    // Stale update with old version should affect 0 rows → throw
    const stale = new VItem();
    (stale as any).id = (item as any).id;
    stale.version = 0; // old
    stale.name = 'C';
    await expect(provider.update(stale, VItem)).rejects.toBeInstanceOf(OptimisticConcurrencyError);
  });
});
