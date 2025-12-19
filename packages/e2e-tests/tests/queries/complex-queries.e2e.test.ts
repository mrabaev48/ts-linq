import { setupTestDatabase, teardownTestDatabase, TestHarness } from '../setup';
import { Entity, Column, PrimaryKey, MetadataStorage } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import type { DatabaseProvider } from '@ts-linq/core';

@Entity({ name: 'comments' })
class Comment {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  text!: string;

  @Column()
  postId!: number;
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
}

@Entity({ name: 'authors' })
class Author {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;
}

class TestDbContext extends DbContext {
  constructor(provider: DatabaseProvider) {
    super({ provider });
  }
}

describe.each(['postgres'] as const)('E2E Complex Queries - %s', (providerName) => {
  let harness: TestHarness;
  let provider: DatabaseProvider;
  let context: TestDbContext;

  beforeAll(async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }
    ({ harness, provider } = await setupTestDatabase(providerName));
    context = new TestDbContext(provider);

    const authorMeta = MetadataStorage.getEntity(Author);
    const postMeta = MetadataStorage.getEntity(Post);
    const commentMeta = MetadataStorage.getEntity(Comment);
    if (authorMeta) await provider.createTable(authorMeta);
    if (postMeta) await provider.createTable(postMeta);
    if (commentMeta) await provider.createTable(commentMeta);

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
    try {
      await provider.executeQuery('DROP TABLE IF EXISTS comments', []);
      await provider.executeQuery('DROP TABLE IF EXISTS posts', []);
      await provider.executeQuery('DROP TABLE IF EXISTS authors', []);
    } catch { /* ignore */ }
    await teardownTestDatabase(harness);
  });

  it('should perform aggregations', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const postSet = context.set(Post);
    const count = await postSet.count();
    const firstPost = await postSet.orderBy((p: Post) => p.id).first();
    
    expect(Number(count)).toBeGreaterThan(0);
    expect(firstPost).toBeDefined();
  });

  it('should perform complex filters with comparison operators', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const postSet = context.set(Post);
    const filtered = await postSet
      .where((p: Post) => p.authorId > 0)
      .toArray();
    
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('should count with filtered query', async () => {
    if (process.env.SKIP_DB_TESTS === '1') {
      return;
    }

    const postSet = context.set(Post);
    const totalCount = await postSet.count();
    const filteredCount = await postSet.where((p: Post) => p.authorId > 0).count();
    
    expect(Number(totalCount)).toBeGreaterThan(0);
    expect(Number(filteredCount)).toBeLessThanOrEqual(Number(totalCount));
  });
});
