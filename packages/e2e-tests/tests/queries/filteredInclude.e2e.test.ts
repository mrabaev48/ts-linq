import { Column, Entity, OneToMany, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'fi_blogs' })
class FiE2EBlog {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @OneToMany(() => FiE2EPost, { foreignKey: 'blogId' })
  posts?: FiE2EPost[];
}

@Entity({ name: 'fi_posts' })
class FiE2EPost {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  title!: string;

  @Column()
  category!: string;

  @Column({ type: 'number', name: 'view_count' })
  viewCount!: number;

  @Column({ type: 'number', name: 'blog_id' })
  blogId!: number;
}

class FiE2EContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E Filtered Include (P1-19) - %s',
  (providerName) => {
    let harness: any;
    let provider: any;
    let context: FiE2EContext;

    beforeAll(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      ({ harness, provider } = await setupTestDatabase(providerName as any));
      context = new FiE2EContext({ provider });
      await context.ensureCreated();

      const blogs = context.set(FiE2EBlog);
      const posts = context.set(FiE2EPost);

      // Blog 1 → 3 posts (2 tech, 1 news); Blog 2 → 2 posts (both tech)
      const blog1 = new FiE2EBlog();
      blog1.name = 'Blog 1';
      blogs.add(blog1);
      const blog2 = new FiE2EBlog();
      blog2.name = 'Blog 2';
      blogs.add(blog2);
      await context.saveChanges();

      const p1 = new FiE2EPost();
      p1.title = 'Tech Post A';
      p1.category = 'tech';
      p1.viewCount = 100;
      p1.blogId = blog1.id;
      posts.add(p1);

      const p2 = new FiE2EPost();
      p2.title = 'News Post';
      p2.category = 'news';
      p2.viewCount = 50;
      p2.blogId = blog1.id;
      posts.add(p2);

      const p3 = new FiE2EPost();
      p3.title = 'Tech Post B';
      p3.category = 'tech';
      p3.viewCount = 200;
      p3.blogId = blog1.id;
      posts.add(p3);

      const p4 = new FiE2EPost();
      p4.title = 'Tech Post C';
      p4.category = 'tech';
      p4.viewCount = 300;
      p4.blogId = blog2.id;
      posts.add(p4);

      const p5 = new FiE2EPost();
      p5.title = 'Tech Post D';
      p5.category = 'tech';
      p5.viewCount = 150;
      p5.blogId = blog2.id;
      posts.add(p5);

      await context.saveChanges();
    });

    afterAll(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      await dropTables(provider, ['fi_blogs', 'fi_posts']);
      await context.dispose();
      await teardownTestDatabase(harness);
    });

    it('where() inside include filters related rows', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const blogs = await context
        .set(FiE2EBlog)
        .include((b: any) => b.posts.where((p: any) => p.category === 'tech'))
        .toArray();

      const blog1 = blogs.find((b) => b.name === 'Blog 1')!;
      expect(blog1.posts).toBeDefined();
      expect(blog1.posts!.length).toBe(2);
      expect(blog1.posts!.every((p: any) => p.category === 'tech')).toBe(true);
    });

    it('orderByDescending() + take() inside include is applied', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const blogs = await context
        .set(FiE2EBlog)
        .include((b: any) =>
          b.posts
            .where((p: any) => p.category === 'tech')
            .orderByDescending((p: any) => p.viewCount)
            .take(1)
        )
        .toArray();

      const blog1 = blogs.find((b) => b.name === 'Blog 1')!;
      expect(blog1.posts!.length).toBe(1);
      // Blog 1 tech posts: viewCount 100 and 200 — top is 200 (Tech Post B)
      expect(blog1.posts![0].viewCount).toBe(200);
    });

    it('multiple parents each get independently filtered results', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const blogs = await context
        .set(FiE2EBlog)
        .include((b: any) => b.posts.where((p: any) => p.category === 'tech'))
        .toArray();

      const blog1 = blogs.find((b) => b.name === 'Blog 1')!;
      const blog2 = blogs.find((b) => b.name === 'Blog 2')!;

      // Blog 1: 2 tech posts; Blog 2: 2 tech posts
      expect(blog1.posts!.length).toBe(2);
      expect(blog2.posts!.length).toBe(2);
    });

    it('plain unfiltered include still works alongside filtered include', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      // Plain include — all 3 posts for Blog 1
      const blogs = await context.set(FiE2EBlog).include('posts').toArray();
      const blog1 = blogs.find((b) => b.name === 'Blog 1')!;
      expect(blog1.posts!.length).toBe(3);
    });
  }
);
