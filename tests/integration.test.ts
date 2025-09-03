import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity, Column, PrimaryKey, OneToMany, ManyToOne } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

// Define test entities inside function to ensure decorators execute properly
function createBlogEntities() {
  @Entity()
  class User {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;

    @Column()
    email!: string;

    @OneToMany(() => Post, { foreignKey: 'userId' })
    posts!: Post[];
  }

  @Entity()
  class Post {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    title!: string;

    @Column()
    content!: string;

    @Column()
    userId!: number;

    @ManyToOne(() => User, { foreignKey: 'userId' })
    user!: User;
  }

  return { User, Post };
}

class BlogDbContext extends DbContext {
  public users!: any;
  public posts!: any;
}

describe('Integration Tests', () => {
  let context: BlogDbContext;
  let User: ReturnType<typeof createBlogEntities>['User'];
  let Post: ReturnType<typeof createBlogEntities>['Post'];

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    // Create test entities
    const entities = createBlogEntities();
    User = entities.User;
    Post = entities.Post;

    context = new BlogDbContext({
      connectionString: ':memory:',
      provider: 'sqlite'
    });

    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
  });

  describe('Complete workflow', () => {
    it('should handle complete CRUD workflow', async () => {
      // Create user
      const user = new User();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      context.set(User).add(user);
      await context.saveChanges();

      expect(user.id).toBeDefined();

      // Create posts for the user
      const post1 = new Post();
      post1.title = 'First Post';
      post1.content = 'Content of first post';
      post1.userId = user.id;

      const post2 = new Post();
      post2.title = 'Second Post';
      post2.content = 'Content of second post';
      post2.userId = user.id;

      context.set(Post).add(post1);
      context.set(Post).add(post2);
      await context.saveChanges();

      // Read - Find user and posts
      const foundUser = await context.set(User).find(user.id);
      expect(foundUser).toBeDefined();
      expect(foundUser!.name).toBe('John Doe');

      const userPosts = await context
        .set(Post)
        .where((p) => p.userId === user.id)
        .toArray();
      expect(userPosts).toHaveLength(2);

      // Update - Modify user
      foundUser!.name = 'John Updated';
      context.set(User).update(foundUser!);
      await context.saveChanges();

      const updatedUser = await context.set(User).find(user.id);
      expect(updatedUser!.name).toBe('John Updated');

      // Delete - Remove a post
      context.set(Post).remove(post1);
      await context.saveChanges();

      const remainingPosts = await context
        .set(Post)
        .where((p) => p.userId === user.id)
        .toArray();
      expect(remainingPosts).toHaveLength(1);
      expect(remainingPosts[0].title).toBe('Second Post');
    });

    it('should handle transactions with rollback', async () => {
      await context.beginTransaction();

      try {
        const user = new User();
        user.name = 'Transaction User';
        user.email = 'transaction@example.com';

        context.set(User).add(user);
        await context.saveChanges();

        // Simulate an error
        throw new Error('Simulated error');
      } catch (error) {
        await context.rollbackTransaction();
      }

      // User should not exist due to rollback
      const users = await context.set(User).toArray();
      expect(users).toHaveLength(0);
    });

    it('should handle transactions with commit', async () => {
      await context.beginTransaction();

      const user = new User();
      user.name = 'Transaction User';
      user.email = 'transaction@example.com';

      context.set(User).add(user);
      await context.saveChanges();
      await context.commitTransaction();

      // User should exist after commit
      const users = await (context as any).provider.findAll(User as any);
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Transaction User');
    });
  });

  describe('Query operations', () => {
    beforeEach(async () => {
      // Create test data
      for (let i = 1; i <= 5; i++) {
        const user = new User();
        user.name = `User ${i}`;
        user.email = `user${i}@example.com`;

        context.set(User).add(user);
        await context.saveChanges();

        for (let j = 1; j <= 2; j++) {
          const post = new Post();
          post.title = `User ${i} Post ${j}`;
          post.content = `Content for user ${i} post ${j}`;
          post.userId = user.id;

          context.set(Post).add(post);
        }
      }
      await context.saveChanges();
    });

    it('should perform complex queries', async () => {
      // Get users with pagination
      const pagedUsers = await context
        .set(User)
        .orderBy((u) => u.name)
        .skip(1)
        .take(2)
        .toArray();

      expect(pagedUsers).toHaveLength(2);
      expect(pagedUsers[0].name).toBe('User 2');

      // Count total posts
      const totalPosts = await context.set(Post).count();
      expect(totalPosts).toBe(10);

      // Get first post
      const firstPost = await context
        .set(Post)
        .orderBy((p) => p.id)
        .first();

      expect(firstPost).toBeDefined();
      expect(firstPost.title).toBe('User 1 Post 1');

      // Check if any users exist
      const anyUsers = await context.set(User).any();
      expect(anyUsers).toBe(true);
    });
  });
});
