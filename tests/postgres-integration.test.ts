import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import type { DbSet } from '../src/context/DbSet';
import type { PostgresProvider } from '../src/providers/PostgresProvider';

const PG_URL = process.env.POSTGRES_URL || '';
const pgDescribe = PG_URL ? describe : describe.skip;

@Entity({ name: 'PgUsers' })
class PgUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class PgCtx extends DbContext {
  public pgusers!: DbSet<PgUser>;
  constructor() {
    super({ connectionString: PG_URL, provider: 'postgresql' });
  }
}

pgDescribe('PostgreSQL integration (requires POSTGRES_URL)', () => {
  test('CRUD happy path', async () => {
    new PgUser();
    const ctx = new PgCtx();
    await ctx.ensureCreated();
    const u = new PgUser();
    u.name = 'pg-user';
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
    const u = new PgUser();
    u.id = 1;
    u.name = 'pg-upsert-1';
    const provider = (ctx as unknown as { provider: PostgresProvider }).provider;
    await provider.upsert(u, PgUser);
    u.name = 'pg-upsert-2';
    await provider.upsert(u, PgUser);
    const found = await provider.findWhere(PgUser, { name: 'pg-upsert-2' });
    expect(found.length).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
