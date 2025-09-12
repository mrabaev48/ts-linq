import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { OptimisticConcurrencyError } from '../src/types';

const PG_URL = process.env.POSTGRES_URL || '';
const pgDescribe = PG_URL ? describe : describe.skip;

@Entity({ name: 'PgItemsV' })
class PgItemV {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'INTEGER', nullable: false }) version!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class PgCtxV extends DbContext {
  public pgitemvs!: any;
  constructor() {
    super({ connectionString: PG_URL, provider: 'postgresql' });
  }
}

pgDescribe('PostgreSQL optimistic concurrency (requires POSTGRES_URL)', () => {
  test('throws OptimisticConcurrencyError on version mismatch', async () => {
    new PgItemV();
    // mark version column
    const meta = MetadataStorage.getEntity(PgItemV)!;
    const vcol = meta.columns.find((c) => c.propertyName === 'version');
    if (vcol) (vcol as any).isVersion = true;

    const ctx = new PgCtxV();
    await ctx.ensureCreated();

    const u = { name: 'pg', version: 0 } as any as PgItemV;
    ctx.pgitemvs.add(u);
    await ctx.saveChanges();

    // first update OK
    u.name = 'pg-1';
    await (ctx as any).provider.update(u, PgItemV);

    // stale update with old version
    const stale: any = { id: (u as any).id, name: 'pg-2', version: 0 };
    await expect((ctx as any).provider.update(stale, PgItemV)).rejects.toBeInstanceOf(
      OptimisticConcurrencyError
    );
    await ctx.dispose();
  });
});
