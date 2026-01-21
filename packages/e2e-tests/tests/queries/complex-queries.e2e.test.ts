import { setupTestDatabase, teardownTestDatabase } from '../../src/setup';
import { Entity, Column, PrimaryKey, ManyToOne, OneToMany } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

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

  @Column()
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

  @Column()
  postId!: number;

  @ManyToOne(() => Post, { inverseSide: 'comments' })
  post?: Post;
}

describe.each(['postgresql'])('E2E Complex Queries - %s', (providerName) => {
  let harness: any;
  let provider: any;
  let context: DbContext;

  beforeAll(async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }
    ({ harness, provider } = await setupTestDatabase(providerName as any));
    context = new DbContext(provider);
    context.register(Author);
    context.register(Post);
    context.register(Comment);
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
    await context?.dropDatabase();
    await teardownTestDatabase(harness);
  });

  it('should perform joins', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const postSet = context.set(Post);
    const postsWithAuthors = await postSet.include(p => p.author).toArray();
    
    expect(postsWithAuthors[0].author).toBeDefined();
    expect(postsWithAuthors[0].author?.name).toBe('John Doe');
  });

  it('should perform nested includes', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const postSet = context.set(Post);
    const postsWithAll = await postSet
      .include(p => p.author)
      .include(p => p.comments)
      .toArray();
    
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
    const firstPost = await postSet.orderBy(p => p.id).first();
    
    expect(count).toBeGreaterThan(0);
    expect(firstPost).toBeDefined();
  });

  it('should perform groupBy operations', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const postSet = context.set(Post);
    const grouped = await postSet
      .groupBy(p => p.authorId)
      .select(g => ({
        authorId: g.key,
        count: g.count()
      }))
      .toArray();
    
    expect(grouped.length).toBeGreaterThan(0);
    expect(grouped[0].count).toBeGreaterThan(0);
  });

  it('should perform complex filters', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const postSet = context.set(Post);
    const filtered = await postSet
      .where(p => p.title.includes('First'))
      .where(p => p.authorId > 0)
      .toArray();
    
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0].title).toContain('First');
  });
});
