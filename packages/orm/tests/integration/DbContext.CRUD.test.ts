import { DbContext } from '../../src/DbContext';
import { DbSet } from '../../src/DbSet';
import { SQLiteProvider } from '@ts-linq/provider-sqlite';
import { MetadataStorage } from '@ts-linq/metadata';

class User {
  id!: number;
  name!: string;
  email!: string;
  age?: number;
  posts!: Post[];
}

class Post {
  id!: number;
  title!: string;
  content!: string;
  userId!: number;
  user!: User;
}

class UserDbContext extends DbContext {
  users!: DbSet<User>;
  posts!: DbSet<Post>;

  constructor(provider: SQLiteProvider) {
    super({ provider });
    this.users = this.set(User);
    this.posts = this.set(Post);
  }
}

function setupMetadata() {
  MetadataStorage.addEntity(User, 'User');

  MetadataStorage.addPrimaryKey(User, 'id');
  MetadataStorage.addColumn(User, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: true,
    isVersion: false
  });

  MetadataStorage.addColumn(User, {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT',
    nullable: false,
    isGenerated: false,
    isVersion: false
  });

  MetadataStorage.addColumn(User, {
    propertyName: 'email',
    columnName: 'email',
    type: 'TEXT',
    nullable: false,
    isGenerated: false,
    isVersion: false
  });

  MetadataStorage.addColumn(User, {
    propertyName: 'age',
    columnName: 'age',
    type: 'INTEGER',
    nullable: true,
    isGenerated: false,
    isVersion: false
  });

  MetadataStorage.addEntity(Post, 'Post');

  MetadataStorage.addPrimaryKey(Post, 'id');
  MetadataStorage.addColumn(Post, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: true,
    isVersion: false
  });

  MetadataStorage.addColumn(Post, {
    propertyName: 'title',
    columnName: 'title',
    type: 'TEXT',
    nullable: false,
    isGenerated: false,
    isVersion: false
  });

  MetadataStorage.addColumn(Post, {
    propertyName: 'content',
    columnName: 'content',
    type: 'TEXT',
    nullable: false,
    isGenerated: false,
    isVersion: false
  });

  MetadataStorage.addColumn(Post, {
    propertyName: 'userId',
    columnName: 'userId',
    type: 'INTEGER',
    nullable: false,
    isGenerated: false,
    isVersion: false
  });
}

describe('ORM Integration - Real User Scenarios', () => {
  let context: UserDbContext;
  let provider: SQLiteProvider;

  beforeAll(() => {
    setupMetadata();
  });

  beforeEach(async () => {
    provider = new SQLiteProvider(':memory:');
    await provider.connect();

    await provider.executeNonQuery(`
      CREATE TABLE User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER
      )
    `);

    await provider.executeNonQuery(`
      CREATE TABLE Post (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        userId INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id)
      )
    `);

    context = new UserDbContext(provider);
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  describe('Basic CRUD Operations', () => {
    test('Create: Insert a new user', async () => {
      const user = new User();
      user.name = 'Alice';
      user.email = 'alice@example.com';
      user.age = 30;

      context.users.add(user);
      const affected = await context.saveChanges();

      expect(affected).toBe(1);
      expect(user.id).toBeGreaterThan(0);
    });

    test('Read: Find user by ID', async () => {
      const user = new User();
      user.name = 'Bob';
      user.email = 'bob@example.com';
      context.users.add(user);
      await context.saveChanges();

      const foundUser = await context.users.find(user.id);

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

      context.users.add(alice);
      context.users.add(bob);
      await context.saveChanges();

      const allUsers = await context.users.toArray();

      expect(allUsers).toHaveLength(2);
      expect(allUsers.map(u => u.name)).toEqual(expect.arrayContaining(['Alice', 'Bob']));
    });

    test('Update: Modify existing user', async () => {
      const user = new User();
      user.name = 'Charlie';
      user.email = 'charlie@old.com';
      user.age = 25;
      context.users.add(user);
      await context.saveChanges();

      user.email = 'charlie@new.com';
      user.age = 26;
      context.users.update(user);
      const affected = await context.saveChanges();

      expect(affected).toBe(1);

      const updated = await context.users.find(user.id);
      expect(updated?.email).toBe('charlie@new.com');
      expect(updated?.age).toBe(26);
    });

    test('Delete: Remove a user', async () => {
      const user = new User();
      user.name = 'David';
      user.email = 'david@example.com';
      context.users.add(user);
      await context.saveChanges();

      const userId = user.id;

      context.users.remove(user);
      const affected = await context.saveChanges();

      expect(affected).toBe(1);

      const deleted = await context.users.find(userId);
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

      users.forEach(u => context.users.add(u));
      const affected = await context.saveChanges();

      expect(affected).toBe(3);

      const allUsers = await context.users.toArray();
      expect(allUsers).toHaveLength(3);
    });

    test('Mixed operations in single saveChanges', async () => {
      const user1 = Object.assign(new User(), { name: 'User1', email: 'user1@test.com' });
      const user2 = Object.assign(new User(), { name: 'User2', email: 'user2@test.com' });
      context.users.add(user1);
      context.users.add(user2);
      await context.saveChanges();

      user1.name = 'UpdatedUser1';
      context.users.update(user1);

      const user3 = Object.assign(new User(), { name: 'User3', email: 'user3@test.com' });
      context.users.add(user3);

      context.users.remove(user2);

      const affected = await context.saveChanges();

      expect(affected).toBe(3);

      const remaining = await context.users.toArray();
      expect(remaining).toHaveLength(2);
      expect(remaining.find(u => u.name === 'UpdatedUser1')).toBeDefined();
      expect(remaining.find(u => u.name === 'User3')).toBeDefined();
      expect(remaining.find(u => u.name === 'User2')).toBeUndefined();
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const users = [
        Object.assign(new User(), { name: 'Alice', email: 'alice@example.com', age: 30 }),
        Object.assign(new User(), { name: 'Bob', email: 'bob@example.com', age: 25 }),
        Object.assign(new User(), { name: 'Charlie', email: 'charlie@example.com', age: 35 }),
        Object.assign(new User(), { name: 'Diana', email: 'diana@example.com', age: 28 })
      ];
      users.forEach(u => context.users.add(u));
      await context.saveChanges();
    });

    test('Query with where clause', async () => {
      const adults = await context.users
        .where(u => (u.age ?? 0) >= 30)
        .toArray();

      expect(adults).toHaveLength(2);
      expect(adults.map(u => u.name)).toEqual(expect.arrayContaining(['Alice', 'Charlie']));
    });

    test('Query with ordering', async () => {
      const ordered = await context.users
        .orderBy(u => u.age)
        .toArray();

      expect(ordered[0].name).toBe('Bob');
      expect(ordered[ordered.length - 1].name).toBe('Charlie');
    });

    test('Query with pagination', async () => {
      const page1 = await context.users
        .orderBy(u => u.name)
        .skip(0)
        .take(2)
        .toArray();

      const page2 = await context.users
        .orderBy(u => u.name)
        .skip(2)
        .take(2)
        .toArray();

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].name).toBe('Alice');
      expect(page2[0].name).toBe('Charlie');
    });

    test('Query with count', async () => {
      const count = await context.users
        .where(u => (u.age ?? 0) >= 30)
        .count();

      expect(count).toBe(2);
    });

    test('Query with firstOrDefault', async () => {
      const user = await context.users
        .where(u => u.name === 'Bob')
        .firstOrDefault();

      expect(user).toBeDefined();
      expect(user?.name).toBe('Bob');
      expect(user?.age).toBe(25);
    });

    test('Query returns null when not found', async () => {
      const user = await context.users
        .where(u => u.name === 'NonExistent')
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
      context.users.add(user);
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

      context.posts.add(post1);
      context.posts.add(post2);
      await context.saveChanges();

      const allPosts = await context.posts.toArray();
      expect(allPosts).toHaveLength(2);
      expect(allPosts.every(p => p.userId === user.id)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('Handle nullable columns', async () => {
      const user = Object.assign(new User(), {
        name: 'NoAge',
        email: 'noage@example.com'
      });

      context.users.add(user);
      await context.saveChanges();

      const found = await context.users.find(user.id);
      expect(found?.age).toBeUndefined();
    });

    test('SaveChanges with no tracked changes returns 0', async () => {
      const affected = await context.saveChanges();
      expect(affected).toBe(0);
    });

    test('Multiple saveChanges calls', async () => {
      const user1 = Object.assign(new User(), { name: 'User1', email: 'user1@test.com' });
      context.users.add(user1);
      await context.saveChanges();

      const user2 = Object.assign(new User(), { name: 'User2', email: 'user2@test.com' });
      context.users.add(user2);
      await context.saveChanges();

      const allUsers = await context.users.toArray();
      expect(allUsers).toHaveLength(2);
    });

    test('Update without previous add is handled gracefully', async () => {
      const user = Object.assign(new User(), {
        id: 999,
        name: 'Ghost',
        email: 'ghost@example.com'
      });

      context.users.update(user);
      const affected = await context.saveChanges();

      expect(affected).toBe(0);
    });
  });

  describe('Real-world User Flows', () => {
    test('Complete blog post workflow', async () => {
      const author = Object.assign(new User(), {
        name: 'John Doe',
        email: 'john@example.com',
        age: 32
      });
      context.users.add(author);
      await context.saveChanges();

      const post = Object.assign(new Post(), {
        title: 'My First Blog Post',
        content: 'This is my first blog post on this platform!',
        userId: author.id
      });
      context.posts.add(post);
      await context.saveChanges();

      post.title = 'My Updated Blog Post';
      post.content = 'Updated content with more details.';
      context.posts.update(post);
      await context.saveChanges();

      const foundPost = await context.posts.find(post.id);
      expect(foundPost?.title).toBe('My Updated Blog Post');
      expect(foundPost?.content).toContain('Updated content');

      const authorPosts = await context.posts
        .where(p => p.userId === author.id)
        .toArray();
      expect(authorPosts).toHaveLength(1);
    });

    test('User registration and profile update', async () => {
      const newUser = Object.assign(new User(), {
        name: 'Jane Smith',
        email: 'jane@example.com'
      });
      context.users.add(newUser);
      await context.saveChanges();
      expect(newUser.id).toBeGreaterThan(0);

      const userId = newUser.id;
      const user = await context.users.find(userId);
      expect(user).toBeDefined();

      if (user) {
        user.age = 28;
        user.name = 'Jane Smith-Johnson';
        context.users.update(user);
        await context.saveChanges();

        const updated = await context.users.find(userId);
        expect(updated?.age).toBe(28);
        expect(updated?.name).toBe('Jane Smith-Johnson');
      }
    });

    test('User deactivation (delete)', async () => {
      const user = Object.assign(new User(), {
        name: 'Inactive User',
        email: 'inactive@example.com'
      });
      context.users.add(user);
      await context.saveChanges();

      const userId = user.id;

      context.users.remove(user);
      await context.saveChanges();

      const deactivated = await context.users.find(userId);
      expect(deactivated).toBeNull();
    });
  });
});
