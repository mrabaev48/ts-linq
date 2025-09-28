import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { OptimisticConcurrencyError } from '../src/types';
import type { DbSet } from '../src/context/DbSet';
import type { MssqlProvider } from '../src/providers/MssqlProvider';

const MSSQL_URL = process.env.MSSQL_URL || '';
const msDescribe = MSSQL_URL ? describe : describe.skip;

@Entity({ name: 'MsItemsV' })
class MsItemV {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'INTEGER', nullable: false }) version!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class MsCtxV extends DbContext {
  public msitemvs!: DbSet<MsItemV>;
  constructor() {
    super({ connectionString: MSSQL_URL, provider: 'mssql' });
  }
}

msDescribe('MSSQL optimistic concurrency (requires MSSQL_URL)', () => {
  test('throws OptimisticConcurrencyError on version mismatch', async () => {
    new MsItemV();
    const meta = MetadataStorage.getEntity(MsItemV)!;
    const vcol = meta.columns.find((c) => c.propertyName === 'version');
    if (vcol) vcol.isVersion = true;
    const ctx = new MsCtxV();
    await ctx.ensureCreated();
    const u = new MsItemV();
    u.name = 'ms';
    u.version = 0;
    ctx.msitemvs.add(u);
    await ctx.saveChanges();
    u.name = 'ms-1';
    const provider = (ctx as unknown as { provider: MssqlProvider }).provider;
    await provider.update(u, MsItemV);
    const stale: MsItemV = { id: u.id, name: 'ms-2', version: 0 } as MsItemV;
    await expect(provider.update(stale, MsItemV)).rejects.toBeInstanceOf(
      OptimisticConcurrencyError
    );
    await ctx.dispose();
  });
});
