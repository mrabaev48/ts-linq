import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';

const PG_URL = process.env.POSTGRES_URL || '';
const pgDescribe = PG_URL ? describe : describe.skip;

@Entity({ name: 'PgUsers' })
class PgUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class PgCtx extends DbContext {
  public pgusers!: any;
  constructor() {
    super({ connectionString: PG_URL, provider: 'postgresql' });
  }
}

pgDescribe('PostgreSQL integration (requires POSTGRES_URL)', () => {
  test('CRUD happy path', async () => {
    new PgUser();
    const ctx = new PgCtx();
    await ctx.ensureCreated();
    const u = { name: 'pg-user' } as any as PgUser;
    ctx.pgusers.add(u);
    await ctx.saveChanges();
    const all = await ctx.pgusers.toArray();
    expect(all.length).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('Upsert works (ON CONFLICT)', async () => {
    new PgUser();
    const ctx = new PgCtx();
    await ctx.ensureCreated();
    const u = { id: 1, name: 'pg-upsert-1' } as any as PgUser;
    await (ctx as any).provider.upsert(u, PgUser);
    u.name = 'pg-upsert-2';
    await (ctx as any).provider.upsert(u, PgUser);
    const found = await (ctx as any).provider.findWhere(PgUser, { name: 'pg-upsert-2' });
    expect(found.length).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
