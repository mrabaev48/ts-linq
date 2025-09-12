import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';

const MYSQL_URL = process.env.MYSQL_URL || '';
const mysqlDescribe = MYSQL_URL ? describe : describe.skip;

@Entity({ name: 'MyUsers' })
class MyUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class MyCtx extends DbContext {
  public myusers!: any;
  constructor() {
    super({ connectionString: MYSQL_URL, provider: 'mysql' });
  }
}

mysqlDescribe('MySQL integration (requires MYSQL_URL)', () => {
  test('CRUD happy path', async () => {
    new MyUser();
    const ctx = new MyCtx();
    await ctx.ensureCreated();
    const u = { name: 'mysql-user' } as any as MyUser;
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
    const u = { id: 1, name: 'mysql-upsert-1' } as any as MyUser;
    await (ctx as any).provider.upsert(u, MyUser);
    u.name = 'mysql-upsert-2';
    await (ctx as any).provider.upsert(u, MyUser);
    const found = await (ctx as any).provider.findWhere(MyUser, { name: 'mysql-upsert-2' });
    expect(found.length).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
