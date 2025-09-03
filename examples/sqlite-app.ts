import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';

@Entity({ name: 'Users' })
class User {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class SqliteCtx extends DbContext {
  public users!: any;
  constructor() {
    super({ connectionString: ':memory:', provider: 'sqlite' });
  }
}

async function main() {
  new User();
  const ctx = new SqliteCtx();
  await ctx.ensureCreated();

  const u = { name: 'sqlite-user' } as any as User;
  ctx.users.add(u);
  await ctx.saveChanges();

  const all = await ctx.users.toArray();
  console.log('users:', all.length);
  await ctx.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
