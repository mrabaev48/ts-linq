import 'reflect-metadata';

import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { PostgresProvider } from '@ts-linq/provider-postgres';

/**
 * Minimal CRUD example: define an entity, connect to PostgreSQL, and exercise
 * add / read / update / delete through DbContext + DbSet.
 *
 * Prerequisite: `docker compose up -d` (see repo root README, "Local PostgreSQL via Docker").
 * Run with: `pnpm --filter @ts-linq/examples build && pnpm --filter @ts-linq/examples example:crud`
 */

@Entity({ name: 'example_users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT', nullable: false })
  name!: string;

  @Column({ type: 'TEXT', nullable: false })
  email!: string;
}

class AppDbContext extends DbContext {
  users = this.defineSet(User);
}

/** Parses `POSTGRES_URL` (same convention as the root README) into a `PostgresProvider` config. */
function providerFromEnv(): PostgresProvider {
  const url = process.env.POSTGRES_URL ?? 'postgres://postgres:postgres@localhost:5432/ts_linq';
  const parsed = new URL(url);
  return new PostgresProvider({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password)
  });
}

async function main(): Promise<void> {
  const ctx = new AppDbContext({ provider: providerFromEnv() });

  await ctx.ensureCreated();

  console.log('--- create ---');
  const alice = new User();
  alice.name = 'Alice';
  alice.email = 'alice@example.com';
  const bob = new User();
  bob.name = 'Bob';
  bob.email = 'bob@example.com';
  ctx.users.add(alice);
  ctx.users.add(bob);
  await ctx.saveChanges();
  console.log(`inserted ${alice.name} (#${alice.id}) and ${bob.name} (#${bob.id})`);

  console.log('--- read ---');
  const all = await ctx.users.orderBy((u) => u.id).toArray();
  console.log(all);

  console.log('--- update ---');
  alice.email = 'alice@newdomain.com';
  ctx.users.update(alice);
  await ctx.saveChanges();
  console.log(`updated ${alice.name}'s email to ${alice.email}`);

  console.log('--- delete ---');
  ctx.users.remove(bob);
  await ctx.saveChanges();
  const remaining = await ctx.users.orderBy((u) => u.id).toArray();
  console.log('remaining users:', remaining);

  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
