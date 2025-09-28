import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { OptimisticConcurrencyError } from '../src/types';
import type { DbSet } from '../src/context/DbSet';
import type { MySqlProvider } from '../src/providers/MySqlProvider';

const MYSQL_URL = process.env.MYSQL_URL || '';
const myDescribe = MYSQL_URL ? describe : describe.skip;

@Entity({ name: 'MyItemsV' })
class MyItemV {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'INTEGER', nullable: false }) version!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class MyCtxV extends DbContext {
  public myitemvs!: DbSet<MyItemV>;
  constructor() {
    super({ connectionString: MYSQL_URL, provider: 'mysql' });
  }
}

myDescribe('MySQL optimistic concurrency (requires MYSQL_URL)', () => {
  test('throws OptimisticConcurrencyError on version mismatch', async () => {
    new MyItemV();
    const meta = MetadataStorage.getEntity(MyItemV)!;
    const versionCol = meta.columns.find((c) => c.propertyName === 'version');
    if (versionCol) versionCol.isVersion = true;
    const ctx = new MyCtxV();
    await ctx.ensureCreated();
    const u = new MyItemV();
    u.name = 'my';
    u.version = 0;
    ctx.myitemvs.add(u);
    await ctx.saveChanges();
    u.name = 'my-1';
    const provider = (ctx as unknown as { provider: MySqlProvider }).provider;
    await provider.update(u, MyItemV);
    const stale: MyItemV = { id: u.id, name: 'my-2', version: 0 } as MyItemV;
    await expect(provider.update(stale, MyItemV)).rejects.toBeInstanceOf(
      OptimisticConcurrencyError
    );
    await ctx.dispose();
  });
});
