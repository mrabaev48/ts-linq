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

class MySqlCtx extends DbContext {
  public users!: any;
  constructor() {
    super({
      connectionString: process.env.MYSQL_URL || 'mysql://root:password@localhost:3306/ts_linq',
      provider: 'mysql'
    });
  }
}

async function main() {
  new User();
  const ctx = new MySqlCtx();
  await ctx.ensureCreated();
  const u = { name: 'mysql-user' } as any as User;
  ctx.users.add(u);
  await ctx.saveChanges();
  const all = await ctx.users.toArray();
  console.log('rows:', all.length);
  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
