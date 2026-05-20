/**
 * Integration tests — AsSplitQuery / AsSingleQuery (P1-18).
 *
 * Verifies:
 * - asSplitQuery() loads 2-level includes without cartesian explosion
 * - asSingleQuery() loads includes via the same batched IN approach
 * - Global default set via DbContextOptionsBuilder.useQuerySplittingBehavior() is propagated
 * - Per-query override of the global default
 * - Row counts are correct — no N×M multiplication
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Column, Entity, OneToMany, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, DbContextOptionsBuilder, QuerySplittingBehavior } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

// ── Entity fixtures ───────────────────────────────────────────────────────────

@Entity({ name: 'sq_tags' })
class SqTag {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  label!: string;

  @Column({ name: 'post_id' })
  postId!: number;
}

@Entity({ name: 'sq_posts' })
class SqPost {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  title!: string;

  @Column({ name: 'blog_id' })
  blogId!: number;

  @OneToMany(() => SqTag, { foreignKey: 'postId' })
  tags!: SqTag[];
}

@Entity({ name: 'sq_blogs' })
class SqBlog {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @OneToMany(() => SqPost, { foreignKey: 'blogId' })
  posts!: SqPost[];
}

// ── Context ───────────────────────────────────────────────────────────────────

class SqContext extends DbContext {
  blogs = this.defineSet(SqBlog);
  posts = this.defineSet(SqPost);
  tags = this.defineSet(SqTag);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(splittingBehavior?: QuerySplittingBehavior): SqContext {
  const provider = new TestProvider(':memory:');
  const builder = new DbContextOptionsBuilder({ provider });
  if (splittingBehavior !== undefined) {
    builder.useQuerySplittingBehavior(splittingBehavior);
  }
  return new SqContext(builder.build());
}

async function seedData(ctx: SqContext): Promise<void> {
  // Blog A → 2 posts, each post → 2 tags
  ctx.set(SqBlog).add(Object.assign(new SqBlog(), { id: 1, name: 'Blog A' }));
  await ctx.saveChanges();

  ctx.set(SqPost).add(Object.assign(new SqPost(), { id: 10, title: 'Post 1', blogId: 1 }));
  ctx.set(SqPost).add(Object.assign(new SqPost(), { id: 11, title: 'Post 2', blogId: 1 }));
  await ctx.saveChanges();

  ctx.set(SqTag).add(Object.assign(new SqTag(), { id: 100, label: 'T1', postId: 10 }));
  ctx.set(SqTag).add(Object.assign(new SqTag(), { id: 101, label: 'T2', postId: 10 }));
  ctx.set(SqTag).add(Object.assign(new SqTag(), { id: 102, label: 'T3', postId: 11 }));
  ctx.set(SqTag).add(Object.assign(new SqTag(), { id: 103, label: 'T4', postId: 11 }));
  await ctx.saveChanges();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AsSplitQuery integration — row counts (no cartesian explosion)', () => {
  let ctx: SqContext;

  beforeEach(async () => {
    ctx = makeCtx();
    await ctx.ensureCreated();
    await seedData(ctx);
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('asSplitQuery(): 1 blog → exactly 1 blog, no cartesian multiplication', async () => {
    const blogs = await ctx.blogs.include('posts').asSplitQuery().toArray();
    expect(blogs).toHaveLength(1);
    expect(blogs[0].posts).toHaveLength(2);
  });

  it('asSingleQuery(): same correct result (batched IN shared path)', async () => {
    const blogs = await ctx.blogs.include('posts').asSingleQuery().toArray();
    expect(blogs).toHaveLength(1);
    expect(blogs[0].posts).toHaveLength(2);
  });

  it('2-level include (posts → tags): correct counts, no cartesian explosion', async () => {
    const blogs = await ctx.blogs
      .include('posts')
      .thenInclude((p: any) => p.tags)
      .asSplitQuery()
      .toArray();

    expect(blogs).toHaveLength(1);
    expect(blogs[0].posts).toHaveLength(2);
    for (const post of blogs[0].posts) {
      expect(post.tags).toHaveLength(2);
    }
  });

  it('toListAsync() is an alias for toArray()', async () => {
    const blogs = await ctx.blogs.include('posts').asSplitQuery().toListAsync();
    expect(blogs).toHaveLength(1);
    expect(blogs[0].posts).toHaveLength(2);
  });

  it('global SplitQuery default propagated from DbContextOptionsBuilder', async () => {
    await ctx.dispose();
    ctx = makeCtx(QuerySplittingBehavior.SplitQuery);
    await ctx.ensureCreated();
    await seedData(ctx);

    const blogs = await ctx.blogs.include('posts').toArray();
    expect(blogs).toHaveLength(1);
    expect(blogs[0].posts).toHaveLength(2);
  });

  it('per-query asSplitQuery() overrides global SingleQuery default', async () => {
    await ctx.dispose();
    ctx = makeCtx(QuerySplittingBehavior.SingleQuery);
    await ctx.ensureCreated();
    await seedData(ctx);

    const blogs = await ctx.blogs.include('posts').asSplitQuery().toArray();
    expect(blogs).toHaveLength(1);
    expect(blogs[0].posts).toHaveLength(2);
  });

  it('per-query asSingleQuery() overrides global SplitQuery default', async () => {
    await ctx.dispose();
    ctx = makeCtx(QuerySplittingBehavior.SplitQuery);
    await ctx.ensureCreated();
    await seedData(ctx);

    const blogs = await ctx.blogs.include('posts').asSingleQuery().toArray();
    expect(blogs).toHaveLength(1);
    expect(blogs[0].posts).toHaveLength(2);
  });
});
