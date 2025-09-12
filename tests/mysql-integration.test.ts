import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import type { DbSet } from '../src/context/DbSet';
import type { MySqlProvider } from '../src/providers/MySqlProvider';

const MYSQL_URL = process.env.MYSQL_URL || '';
const mysqlDescribe = MYSQL_URL ? describe : describe.skip;

@Entity({ name: 'MyUsers' })
class MyUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class MyCtx extends DbContext {
  public myusers!: DbSet<MyUser>;
  constructor() {
    super({ connectionString: MYSQL_URL, provider: 'mysql' });
  }
}

mysqlDescribe('MySQL integration (requires MYSQL_URL)', () => {
  test('CRUD happy path', async () => {
    new MyUser();
    const ctx = new MyCtx();
    await ctx.ensureCreated();
    const u = new MyUser();
    u.name = 'mysql-user';
    ctx.myusers.add(u);
    await ctx.saveChanges();
    const all = await ctx.myusers.toArray();
    expect(all.length).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('Upsert works (ON DUPLICATE KEY)', async () => {
    new MyUser();
    const ctx = new MyCtx();
    await ctx.ensureCreated();
    const u = new MyUser();
    u.id = 1;
    u.name = 'mysql-upsert-1';
    const provider = (ctx as unknown as { provider: MySqlProvider }).provider;
    await provider.upsert(u, MyUser);
    u.name = 'mysql-upsert-2';
    await provider.upsert(u, MyUser);
    const found = await provider.findWhere(MyUser, { name: 'mysql-upsert-2' });
    expect(found.length).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
