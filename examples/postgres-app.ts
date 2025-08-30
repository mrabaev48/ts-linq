import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';

@Entity({ name: 'DemoUsers' })
class DemoUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class PgDemoContext extends DbContext {
  public demousers!: DbSet<DemoUser>;
  constructor() {
    super({ provider: 'postgresql', connectionString: process.env.POSTGRES_URL || '' });
  }
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('Set POSTGRES_URL env var to run this example');
    process.exit(1);
  }
  const ctx = new PgDemoContext();
  await ctx.ensureCreated();
  const u = new DemoUser();
  u.name = 'PG Demo';
  ctx.demousers.add(u);
  await ctx.saveChanges();
  const all = await ctx.demousers.toArray();
  console.log('Users:', all.length);
  await ctx.dispose();
}

main().catch(err => { console.error(err); process.exit(1); });


