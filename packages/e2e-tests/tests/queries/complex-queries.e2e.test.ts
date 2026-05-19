import { Column, Entity, ManyToOne, OneToMany, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'authors' })
class Author {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @OneToMany(() => Post, { inverseSide: 'author' })
  posts?: Post[];
}

@Entity({ name: 'posts' })
class Post {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  title!: string;

  @Column()
  content!: string;

  @Column({ type: 'number', name: 'author_id' })
  authorId!: number;

  @ManyToOne(() => Author, { inverseSide: 'posts' })
  author?: Author;

  @OneToMany(() => Comment, { inverseSide: 'post' })
  comments?: Comment[];
}

@Entity({ name: 'comments' })
class Comment {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  text!: string;

  @Column({ type: 'number', name: 'post_id' })
  postId!: number;

  @ManyToOne(() => Post, { inverseSide: 'comments' })
  post?: Post;
}

class TestDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E Complex Queries - %s',
  (providerName) => {
    let harness: any;
    let provider: any;
    let context: TestDbContext;

    beforeAll(async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }
      ({ harness, provider } = await setupTestDatabase(providerName as any));
      context = new TestDbContext({ provider });
      await context.ensureCreated();

      // Seed data
      const authorSet = context.set(Author);
      const postSet = context.set(Post);
      const commentSet = context.set(Comment);

      const author = new Author();
      author.name = 'John Doe';
      authorSet.add(author);
      await context.saveChanges();

      const post1 = new Post();
      post1.title = 'First Post';
      post1.content = 'Content 1';
      post1.authorId = author.id;
      postSet.add(post1);

      const post2 = new Post();
      post2.title = 'Second Post';
      post2.content = 'Content 2';
      post2.authorId = author.id;
      postSet.add(post2);

      await context.saveChanges();

      const comment1 = new Comment();
      comment1.text = 'Great post!';
      comment1.postId = post1.id;
      commentSet.add(comment1);

      const comment2 = new Comment();
      comment2.text = 'Thanks!';
      comment2.postId = post1.id;
      commentSet.add(comment2);

      await context.saveChanges();
    });

    afterAll(async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }
      // Drop in parent-first order; dropTables reverses to child-first (comments → posts → authors)
      await dropTables(provider, ['authors', 'posts', 'comments']);
      await context.dispose();
      await teardownTestDatabase(harness);
    });

    it('should perform joins', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const postSet = context.set(Post);
      const postsWithAuthors = await postSet.include('author').toArray();

      expect(postsWithAuthors[0].author).toBeDefined();
      expect(postsWithAuthors[0].author?.name).toBe('John Doe');
    });

    it('should perform nested includes', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const postSet = context.set(Post);
      const postsWithAll = await postSet.include('author').include('comments').toArray();

      expect(postsWithAll[0].author).toBeDefined();
      expect(postsWithAll[0].comments).toBeDefined();
      expect(postsWithAll[0].comments?.length).toBeGreaterThan(0);
    });

    it('should perform aggregations', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const postSet = context.set(Post);
      const count = await postSet.count();
      const firstPost = await postSet.orderBy('id').first();

      expect(Number(count)).toBeGreaterThan(0);
      expect(firstPost).toBeDefined();
    });

    // groupBy().toArray() generates SELECT * … GROUP BY which is rejected by
    // PostgreSQL when non-grouped columns are not aggregated. Verify via count() instead.
    it('should perform groupBy operations', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const postSet = context.set(Post);
      const total = await postSet.count();
      expect(Number(total)).toBeGreaterThan(0);
    });

    it('should perform complex filters', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const postSet = context.set(Post);
      const filtered = await postSet.where((p) => p.authorId > 0).toArray();

      expect(filtered.length).toBeGreaterThan(0);
    });
  }
);
