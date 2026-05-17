import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { Column, Entity, ManyToOne, OneToMany, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../../src/DbContext';
import { TestProvider } from '../stubs/TestProvider';

@Entity()
class User {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;

  @Column({ type: 'TEXT' })
  email!: string;

  @Column({ type: 'INTEGER', nullable: true })
  age?: number;

  @OneToMany(() => Post, { inverseSide: 'userId' })
  posts!: Post[];
}

@Entity()
class Post {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  title!: string;

  @Column({ type: 'TEXT' })
  content!: string;

  @Column({ type: 'INTEGER' })
  userId!: number;

  @ManyToOne(() => User, { inverseSide: 'posts' })
  user!: User;
}

class UserDbContext extends DbContext {}

describe('ORM Integration - Real User Scenarios (With Decorators)', () => {
  let context: UserDbContext;
  let provider: TestProvider;

  beforeEach(async () => {
    provider = new TestProvider(':memory:');
    await provider.connect();
    context = new UserDbContext({ provider: provider });
    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
    await provider.disconnect();
  });

  describe('Basic CRUD Operations', () => {
    test('Create: Insert a new user', async () => {
      const user = new User();
      user.name = 'Alice';
      user.email = 'alice@example.com';
      user.age = 30;

      context.set(User).add(user);
      const affected = await context.saveChanges();

      expect(affected).toBeGreaterThanOrEqual(1);
      expect(user.id).toBeGreaterThan(0);
    });

    test('Read: Find user by ID', async () => {
      const user = new User();
      user.name = 'Bob';
      user.email = 'bob@example.com';
      context.set(User).add(user);
      await context.saveChanges();

      const foundUser = await context.find(User, user.id);

      expect(foundUser).toBeDefined();
      expect(foundUser?.name).toBe('Bob');
      expect(foundUser?.email).toBe('bob@example.com');
    });

    test('Read: Get all users', async () => {
      const alice = new User();
      alice.name = 'Alice';
      alice.email = 'alice@example.com';

      const bob = new User();
      bob.name = 'Bob';
      bob.email = 'bob@example.com';

      context.set(User).add(alice);
      context.set(User).add(bob);
      await context.saveChanges();

      const allUsers = await context.set(User).query().toArray();

      expect(allUsers).toHaveLength(2);
      expect(allUsers.map((u) => u.name)).toEqual(expect.arrayContaining(['Alice', 'Bob']));
    });

    test('Update: Modify existing user', async () => {
      const user = new User();
      user.name = 'Charlie';
      user.email = 'charlie@old.com';
      user.age = 25;
      context.set(User).add(user);
      await context.saveChanges();

      user.email = 'charlie@new.com';
      user.age = 26;
      context.set(User).update(user);
      const affected = await context.saveChanges();

      expect(affected).toBe(1);

      const updated = await context.find(User, user.id);
      expect(updated?.email).toBe('charlie@new.com');
      expect(updated?.age).toBe(26);
    });

    test('Delete: Remove a user', async () => {
      const user = new User();
      user.name = 'David';
      user.email = 'david@example.com';
      context.set(User).add(user);
      await context.saveChanges();

      const userId = user.id;

      context.set(User).remove(user);
      const affected = await context.saveChanges();

      expect(affected).toBe(1);

      const deleted = await context.find(User, userId);
      expect(deleted).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    test('Insert multiple users in single transaction', async () => {
      const users = [
        Object.assign(new User(), { name: 'User1', email: 'user1@test.com', age: 20 }),
        Object.assign(new User(), { name: 'User2', email: 'user2@test.com', age: 25 }),
        Object.assign(new User(), { name: 'User3', email: 'user3@test.com', age: 30 })
      ];

      users.forEach((u) => context.set(User).add(u));
      const affected = await context.saveChanges();

      expect(affected).toBe(3);

      const allUsers = await context.set(User).query().toArray();
      expect(allUsers).toHaveLength(3);
    });

    test('Mixed operations in single saveChanges', async () => {
      const user1 = Object.assign(new User(), { name: 'User1', email: 'user1@test.com' });
      const user2 = Object.assign(new User(), { name: 'User2', email: 'user2@test.com' });
      context.set(User).add(user1);
      context.set(User).add(user2);
      await context.saveChanges();

      user1.name = 'UpdatedUser1';
      context.set(User).update(user1);

      const user3 = Object.assign(new User(), { name: 'User3', email: 'user3@test.com' });
      context.set(User).add(user3);

      context.set(User).remove(user2);

      const affected = await context.saveChanges();

      expect(affected).toBe(3);

      const remaining = await context.set(User).query().toArray();
      expect(remaining).toHaveLength(2);
      expect(remaining.find((u) => u.name === 'UpdatedUser1')).toBeDefined();
      expect(remaining.find((u) => u.name === 'User3')).toBeDefined();
      expect(remaining.find((u) => u.name === 'User2')).toBeUndefined();
    });
  });

  describe('Query Operations - Type Safety', () => {
    beforeEach(async () => {
      const users = [
        Object.assign(new User(), { name: 'Alice', email: 'alice@example.com', age: 30 }),
        Object.assign(new User(), { name: 'Bob', email: 'bob@example.com', age: 25 }),
        Object.assign(new User(), { name: 'Charlie', email: 'charlie@example.com', age: 35 }),
        Object.assign(new User(), { name: 'Diana', email: 'diana@example.com', age: 28 })
      ];
      users.forEach((u) => context.set(User).add(u));
      await context.saveChanges();
    });

    test('Query with where clause', async () => {
      const adults = await context
        .set(User)
        .query()
        .whereCompiled({
          ast: {
            type: 'binary',
            left: { type: 'property', path: ['age'] },
            operator: '>=',
            right: { type: 'literal', value: 30 }
          },
          parameters: []
        })
        .toArray();

      expect(adults.length).toBeGreaterThanOrEqual(2);
      expect(adults.every((u) => (u.age ?? 0) >= 30)).toBe(true);
    });

    test('Query with ordering', async () => {
      const ordered = await context.set(User).query().orderBy('name').toArray();

      expect(ordered[0].name).toBe('Alice');
      expect(ordered[ordered.length - 1].name).toBe('Diana');
    });

    test('Query with pagination', async () => {
      const page1 = await context.set(User).query().orderBy('name').skip(0).take(2).toArray();

      const page2 = await context.set(User).query().orderBy('name').skip(2).take(2).toArray();

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].name).toBe('Alice');
      expect(page2[0].name).toBe('Charlie');
    });

    test('Query with count', async () => {
      const count = await context
        .set(User)
        .query()
        .whereCompiled({
          ast: {
            type: 'binary',
            left: { type: 'property', path: ['age'] },
            operator: '>=',
            right: { type: 'literal', value: 30 }
          },
          parameters: []
        })
        .count();

      expect(count).toBeGreaterThanOrEqual(2);
    });

    test('Query with firstOrDefault', async () => {
      const user = await context
        .set(User)
        .query()
        .whereCompiled({
          ast: {
            type: 'binary',
            left: { type: 'property', path: ['name'] },
            operator: '===',
            right: { type: 'literal', value: 'Bob' }
          },
          parameters: []
        })
        .firstOrDefault();

      expect(user).toBeDefined();
      expect(user?.name).toBe('Bob');
      expect(user?.age).toBe(25);
    });

    test('Query returns null when not found', async () => {
      const user = await context
        .set(User)
        .query()
        .whereCompiled({
          ast: {
            type: 'binary',
            left: { type: 'property', path: ['name'] },
            operator: '===',
            right: { type: 'literal', value: 'NonExistent' }
          },
          parameters: []
        })
        .firstOrDefault();

      expect(user).toBeNull();
    });
  });

  describe('Relationships', () => {
    test('Create user with posts', async () => {
      const user = Object.assign(new User(), {
        name: 'Blogger',
        email: 'blogger@example.com'
      });
      context.set(User).add(user);
      await context.saveChanges();

      const post1 = Object.assign(new Post(), {
        title: 'First Post',
        content: 'Hello World!',
        userId: user.id
      });

      const post2 = Object.assign(new Post(), {
        title: 'Second Post',
        content: 'Another post',
        userId: user.id
      });

      context.set(Post).add(post1);
      context.set(Post).add(post2);
      await context.saveChanges();

      const allPosts = await context.set(Post).query().toArray();
      expect(allPosts).toHaveLength(2);
      expect(allPosts.every((p) => p.userId === user.id)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('Handle nullable columns', async () => {
      const user = Object.assign(new User(), {
        name: 'NoAge',
        email: 'noage@example.com'
      });

      context.set(User).add(user);
      await context.saveChanges();

      const found = await context.find(User, user.id);
      expect(found?.age).toBeUndefined();
    });

    test('SaveChanges with no tracked changes returns 0', async () => {
      const affected = await context.saveChanges();
      expect(affected).toBe(0);
    });

    test('Multiple saveChanges calls', async () => {
      const user1 = Object.assign(new User(), { name: 'User1', email: 'user1@test.com' });
      context.set(User).add(user1);
      await context.saveChanges();

      const user2 = Object.assign(new User(), { name: 'User2', email: 'user2@test.com' });
      context.set(User).add(user2);
      await context.saveChanges();

      const allUsers = await context.set(User).query().toArray();
      expect(allUsers).toHaveLength(2);
    });
  });

  describe('Real-world User Flows', () => {
    test('Complete blog post workflow', async () => {
      const author = Object.assign(new User(), {
        name: 'John Doe',
        email: 'john@example.com',
        age: 32
      });
      context.set(User).add(author);
      await context.saveChanges();

      const post = Object.assign(new Post(), {
        title: 'My First Blog Post',
        content: 'This is my first blog post on this platform!',
        userId: author.id
      });
      context.set(Post).add(post);
      await context.saveChanges();

      post.title = 'My Updated Blog Post';
      post.content = 'Updated content with more details.';
      context.set(Post).update(post);
      await context.saveChanges();

      const foundPost = await context.find(Post, post.id);
      expect(foundPost?.title).toBe('My Updated Blog Post');
      expect(foundPost?.content).toContain('Updated content');

      const authorPosts = await context
        .set(Post)
        .query()
        .whereCompiled({
          ast: {
            type: 'binary',
            left: { type: 'property', path: ['userId'] },
            operator: '===',
            right: { type: 'literal', value: author.id }
          },
          parameters: []
        })
        .toArray();
      expect(authorPosts).toHaveLength(1);
    });

    test('User registration and profile update', async () => {
      const newUser = Object.assign(new User(), {
        name: 'Jane Smith',
        email: 'jane@example.com'
      });
      context.set(User).add(newUser);
      await context.saveChanges();
      expect(newUser.id).toBeGreaterThan(0);

      const userId = newUser.id;
      const user = await context.find(User, userId);
      expect(user).toBeDefined();

      if (user) {
        user.age = 28;
        user.name = 'Jane Smith-Johnson';
        context.set(User).update(user);
        await context.saveChanges();

        const updated = await context.find(User, userId);
        expect(updated?.age).toBe(28);
        expect(updated?.name).toBe('Jane Smith-Johnson');
      }
    });

    test('User deactivation (delete)', async () => {
      const user = Object.assign(new User(), {
        name: 'Inactive User',
        email: 'inactive@example.com'
      });
      context.set(User).add(user);
      await context.saveChanges();

      const userId = user.id;

      context.set(User).remove(user);
      await context.saveChanges();

      const deactivated = await context.find(User, userId);
      expect(deactivated).toBeNull();
    });
  });

  describe('DbContext Lifecycle', () => {
    test('Context creation with provider succeeds', () => {
      expect(context).toBeDefined();
      expect(context.set(User)).toBeDefined();
      expect(context.set(Post)).toBeDefined();
    });

    test('DbSet methods are properly initialized', () => {
      const userSet = context.set(User);
      expect(typeof userSet.add).toBe('function');
      expect(typeof userSet.update).toBe('function');
      expect(typeof userSet.remove).toBe('function');
      expect(typeof userSet.query).toBe('function');
    });
  });
});
