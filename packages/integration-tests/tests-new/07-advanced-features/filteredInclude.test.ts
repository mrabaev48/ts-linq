/**
 * Integration tests — Filtered Include (P1-19).
 *
 * Verifies:
 * - where() inside include filters related rows in-memory
 * - orderByDescending() + take() inside include is applied correctly
 * - Multiple parents each get independently filtered related rows
 * - Plain (unfiltered) include still works alongside filtered includes
 * - thenInclude after filtered include loads nested relations correctly
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Column, Entity, OneToMany, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, DbContextOptionsBuilder } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

// ── Entity fixtures ───────────────────────────────────────────────────────────

@Entity({ name: 'fi_tags' })
class FiTag {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  label!: string;

  @Column({ name: 'post_id' })
  postId!: number;
}

@Entity({ name: 'fi_posts' })
class FiPost {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  title!: string;

  @Column({ name: 'is_published' })
  isPublished!: boolean;

  @Column({ name: 'published_at' })
  publishedAt!: string;

  @Column({ name: 'blog_id' })
  blogId!: number;

  @OneToMany(() => FiTag, { foreignKey: 'postId' })
  tags!: FiTag[];
}

@Entity({ name: 'fi_blogs' })
class FiBlog {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @OneToMany(() => FiPost, { foreignKey: 'blogId' })
  posts!: FiPost[];
}

// ── Context ───────────────────────────────────────────────────────────────────

class FiContext extends DbContext {
  blogs = this.defineSet(FiBlog);
  posts = this.defineSet(FiPost);
  tags = this.defineSet(FiTag);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(): FiContext {
  const provider = new TestProvider(':memory:');
  const builder = new DbContextOptionsBuilder({ provider });
  return new FiContext(builder.build());
}

async function seedData(ctx: FiContext): Promise<void> {
  // Blog 1 → posts 10 (published), 11 (unpublished), 12 (published)
  ctx.set(FiBlog).add(Object.assign(new FiBlog(), { id: 1, name: 'Blog 1' }));
  // Blog 2 → posts 20 (published), 21 (published)
  ctx.set(FiBlog).add(Object.assign(new FiBlog(), { id: 2, name: 'Blog 2' }));
  await ctx.saveChanges();

  ctx.set(FiPost).add(
    Object.assign(new FiPost(), {
      id: 10,
      title: 'Post A',
      isPublished: true,
      publishedAt: '2024-03-01',
      blogId: 1
    })
  );
  ctx.set(FiPost).add(
    Object.assign(new FiPost(), {
      id: 11,
      title: 'Post B',
      isPublished: false,
      publishedAt: '2024-06-01',
      blogId: 1
    })
  );
  ctx.set(FiPost).add(
    Object.assign(new FiPost(), {
      id: 12,
      title: 'Post C',
      isPublished: true,
      publishedAt: '2024-12-01',
      blogId: 1
    })
  );
  ctx.set(FiPost).add(
    Object.assign(new FiPost(), {
      id: 20,
      title: 'Post D',
      isPublished: true,
      publishedAt: '2024-01-01',
      blogId: 2
    })
  );
  ctx.set(FiPost).add(
    Object.assign(new FiPost(), {
      id: 21,
      title: 'Post E',
      isPublished: true,
      publishedAt: '2024-09-01',
      blogId: 2
    })
  );
  await ctx.saveChanges();

  // Post 10 → tags 100, 101; Post 12 → tag 102
  ctx.set(FiTag).add(Object.assign(new FiTag(), { id: 100, label: 'typescript', postId: 10 }));
  ctx.set(FiTag).add(Object.assign(new FiTag(), { id: 101, label: 'orm', postId: 10 }));
  ctx.set(FiTag).add(Object.assign(new FiTag(), { id: 102, label: 'testing', postId: 12 }));
  await ctx.saveChanges();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Filtered Include integration (P1-19)', () => {
  let ctx: FiContext;

  beforeEach(async () => {
    ctx = makeCtx();
    await ctx.ensureCreated();
    await seedData(ctx);
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('where() inside include filters related rows', async () => {
    const blogs = await ctx.blogs
      .include((b: any) => b.posts.where((p: any) => p.isPublished))
      .toArray();

    expect(blogs).toHaveLength(2);
    const blog1 = blogs.find((b) => b.id === 1)!;
    expect(blog1.posts).toHaveLength(2);
    expect(blog1.posts.every((p: any) => p.isPublished)).toBe(true);
  });

  it('orderByDescending() + take() inside include is applied', async () => {
    const blogs = await ctx.blogs
      .include((b: any) =>
        b.posts
          .where((p: any) => p.isPublished)
          .orderByDescending((p: any) => p.publishedAt)
          .take(1)
      )
      .toArray();

    const blog1 = blogs.find((b) => b.id === 1)!;
    expect(blog1.posts).toHaveLength(1);
    // publishedAt '2024-12-01' > '2024-03-01', so Post C (id 12) comes first
    expect(blog1.posts[0].id).toBe(12);
  });

  it('multiple parents each get independently filtered related rows', async () => {
    const blogs = await ctx.blogs
      .include((b: any) => b.posts.where((p: any) => p.isPublished))
      .toArray();

    const blog1 = blogs.find((b) => b.id === 1)!;
    const blog2 = blogs.find((b) => b.id === 2)!;

    // Blog 1: posts 10 (published) and 12 (published), not 11 (unpublished)
    expect(blog1.posts).toHaveLength(2);
    expect(blog1.posts.map((p: any) => p.id).sort()).toEqual([10, 12]);

    // Blog 2: both posts 20 and 21 are published
    expect(blog2.posts).toHaveLength(2);
    expect(blog2.posts.map((p: any) => p.id).sort()).toEqual([20, 21]);
  });

  it('plain unfiltered include still works correctly', async () => {
    const blogs = await ctx.blogs.include('posts').toArray();

    const blog1 = blogs.find((b) => b.id === 1)!;
    // All 3 posts for blog 1, including unpublished
    expect(blog1.posts).toHaveLength(3);
  });

  it('thenInclude after filtered include loads nested relations', async () => {
    const blogs = await ctx.blogs
      .include((b: any) => b.posts.where((p: any) => p.isPublished))
      .thenInclude((p: any) => p.tags)
      .toArray();

    const blog1 = blogs.find((b) => b.id === 1)!;
    // Only published posts (10, 12)
    expect(blog1.posts).toHaveLength(2);

    const post10 = blog1.posts.find((p: any) => p.id === 10)!;
    const post12 = blog1.posts.find((p: any) => p.id === 12)!;

    expect(post10.tags).toHaveLength(2);
    expect(post12.tags).toHaveLength(1);
    expect(post12.tags[0].label).toBe('testing');
  });
});
