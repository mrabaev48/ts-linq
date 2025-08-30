import 'reflect-metadata';
import { DbContext, DbSet } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';

@Entity({ name: 'Users' })
class User {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class MssqlAppDbContext extends DbContext {
  public users!: DbSet<User>;
  constructor() {
    super({
      connectionString: process.env.MSSQL_URL || 'Server=localhost;Database=ts_linq;User Id=sa;Password=Your_password123;Encrypt=false',
      provider: 'mssql'
    });
  }
}

async function main() {
  const ctx = new MssqlAppDbContext();
  await ctx.ensureCreated();

  const u = new User();
  u.name = 'Alice';
  ctx.users.add(u);
  await ctx.saveChanges();

  const all = await ctx.users.toArray();
  console.log('users count:', all.length);

  await ctx.dispose();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


