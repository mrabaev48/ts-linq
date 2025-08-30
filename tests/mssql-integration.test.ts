import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';

const MSSQL_URL = process.env.MSSQL_URL || '';
const mssqlDescribe = MSSQL_URL ? describe : describe.skip;

@Entity({ name: 'MsUsers' })
class MsUser { @PrimaryKey({ autoIncrement: true }) id!: number; @Column({ type: 'TEXT', nullable: false }) name!: string; }

class MsCtx extends DbContext { public msusers!: any; constructor() { super({ connectionString: MSSQL_URL, provider: 'mssql' }); } }

mssqlDescribe('MSSQL integration (requires MSSQL_URL)', () => {
  test('CRUD happy path', async () => {
    new MsUser();
    const ctx = new MsCtx();
    await ctx.ensureCreated();
    const u = { name: 'ms-user' } as any as MsUser;
    ctx.msusers.add(u);
    await ctx.saveChanges();
    const all = await ctx.msusers.toArray();
    expect(all.length).toBeGreaterThan(0);
    await ctx.dispose();
  });
});


