import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import type { DbSet } from '../src/context/DbSet';
import type { MssqlProvider } from '../src/providers/MssqlProvider';

const MSSQL_URL = process.env.MSSQL_URL || '';
const mssqlDescribe = MSSQL_URL ? describe : describe.skip;

@Entity({ name: 'MsUsers' })
class MsUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class MsCtx extends DbContext {
  public msusers!: DbSet<MsUser>;
  constructor() {
    super({ connectionString: MSSQL_URL, provider: 'mssql' });
  }
}

mssqlDescribe('MSSQL integration (requires MSSQL_URL)', () => {
  test('CRUD happy path', async () => {
    new MsUser();
    const ctx = new MsCtx();
    await ctx.ensureCreated();
    const u = new MsUser();
    u.name = 'ms-user';
    ctx.msusers.add(u);
    await ctx.saveChanges();
    const all = await ctx.msusers.toArray();
    expect(all.length).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('Upsert works (MERGE)', async () => {
    new MsUser();
    const ctx = new MsCtx();
    await ctx.ensureCreated();
    const u = new MsUser();
    u.id = 1;
    u.name = 'ms-upsert-1';
    const provider = (ctx as unknown as { provider: MssqlProvider }).provider;
    await provider.upsert(u, MsUser);
    u.name = 'ms-upsert-2';
    await provider.upsert(u, MsUser);
    const found = await provider.findWhere(MsUser, { name: 'ms-upsert-2' });
    expect(found.length).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
