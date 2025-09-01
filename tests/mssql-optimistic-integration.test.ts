import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { OptimisticConcurrencyError } from '../src/types';

const MSSQL_URL = process.env.MSSQL_URL || '';
const msDescribe = MSSQL_URL ? describe : describe.skip;

@Entity({ name: 'MsItemsV' })
class MsItemV { @PrimaryKey({ autoIncrement: true }) id!: number; @Column({ type: 'INTEGER', nullable: false }) version!: number; @Column({ type: 'TEXT', nullable: false }) name!: string; }

class MsCtxV extends DbContext { public msitemvs!: any; constructor() { super({ connectionString: MSSQL_URL, provider: 'mssql' }); } }

msDescribe('MSSQL optimistic concurrency (requires MSSQL_URL)', () => {
  test('throws OptimisticConcurrencyError on version mismatch', async () => {
    new MsItemV();
    const meta = MetadataStorage.getEntity(MsItemV)!;
    (meta.columns.find(c => c.propertyName === 'version') as any).isVersion = true;
    const ctx = new MsCtxV();
    await ctx.ensureCreated();
    const u = { name: 'ms', version: 0 } as any as MsItemV;
    ctx.msitemvs.add(u);
    await ctx.saveChanges();
    u.name = 'ms-1';
    await (ctx as any).provider.update(u, MsItemV);
    const stale: any = { id: (u as any).id, name: 'ms-2', version: 0 };
    await expect((ctx as any).provider.update(stale, MsItemV)).rejects.toBeInstanceOf(OptimisticConcurrencyError);
    await ctx.dispose();
  });
});


