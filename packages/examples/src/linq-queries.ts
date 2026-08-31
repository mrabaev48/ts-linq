import 'reflect-metadata';

import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { PostgresProvider } from '@ts-linq/provider-postgres';

/**
 * LINQ-style querying example: `where` / `orderBy` / `select` / pagination / `count`
 * against a `DbSet<Post>`. `where(...)` and `select(...)` are rewritten at build time
 * by the compile-time predicate transformer (see the root README).
 *
 * Prerequisite: `docker compose up -d` (see repo root README, "Local PostgreSQL via Docker").
 * Run with: `pnpm --filter @ts-linq/examples build && pnpm --filter @ts-linq/examples example:linq-queries`
 */

@Entity({ name: 'example_posts' })
class Post {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT', nullable: false })
  title!: string;

  @Column({ type: 'BOOLEAN', nullable: false })
  published!: boolean;

  @Column({ type: 'INTEGER', nullable: false })
  views!: number;
}

class BlogDbContext extends DbContext {
  posts = this.defineSet(Post);
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
  const ctx = new BlogDbContext({ provider: providerFromEnv() });
  await ctx.ensureCreated();

  const seed: Array<Pick<Post, 'title' | 'published' | 'views'>> = [
    { title: 'Getting started with ts-linq', published: true, views: 120 },
    { title: 'Change tracking internals', published: true, views: 45 },
    { title: 'Draft: multi-dialect DDL', published: false, views: 0 },
    { title: 'Compile-time predicates', published: true, views: 300 },
    { title: 'Draft: spatial types', published: false, views: 0 }
  ];
  for (const row of seed) {
    const post = new Post();
    post.title = row.title;
    post.published = row.published;
    post.views = row.views;
    ctx.posts.add(post);
  }
  await ctx.saveChanges();

  console.log('--- where (compound predicate) + orderByDescending ---');
  const popularPublished = await ctx.posts
    .where((p) => p.published === true && p.views > 50)
    .orderByDescending((p) => p.views)
    .toArray();
  console.log(popularPublished.map((p) => `${p.title} (${p.views} views)`));

  console.log('--- select projection ---');
  const titles = await ctx.posts
    .where((p) => p.published === true)
    .select((p) => ({ id: p.id, title: p.title }))
    .toArray();
  console.log(titles);

  console.log('--- pagination (skip/take) ---');
  const page = await ctx.posts
    .orderBy((p) => p.id)
    .skip(1)
    .take(2)
    .toArray();
  console.log(page.map((p) => p.title));

  console.log('--- count ---');
  const publishedCount = await ctx.posts.where((p) => p.published === true).count();
  console.log(`published posts: ${publishedCount}`);

  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
