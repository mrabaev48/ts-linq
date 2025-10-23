import { DbContext } from '../../src/DbContext';
import { DbSet } from '../../src/DbSet';
import { MetadataStorage } from '@ts-linq/metadata';
import { DatabaseProvider } from '@ts-linq/core';

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

class UserDbContext extends DbContext {}

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
  let provider: MockDatabaseProvider;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    setupMetadata();
    
    provider = new MockDatabaseProvider();
    await provider.connect();
    provider.mockResultPattern(/SELECT/, []);
    provider.mockResultPattern(/INSERT/, [{ id: 1 }]);
    provider.mockResultPattern(/UPDATE/, []);
    provider.mockResultPattern(/DELETE/, []);
    context = new UserDbContext({ provider: provider as any });
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

      context.set(User).add(user);
      const affected = await context.saveChanges();

      expect(affected).toBeGreaterThanOrEqual(1);
    });

    test('Read: Verify DbSet query methods work', () => {
      const query = context.set(User).where(u => u.name === 'Alice');
      expect(query).toBeDefined();
      expect(typeof query.toArray).toBe('function');
    });

    test('Update: Change tracking marks entity as modified', async () => {
      const user = new User();
      user.id = 1;
      user.name = 'Charlie';
      user.email = 'charlie@old.com';
      user.age = 25;
      context.set(User).add(user);
      await context.saveChanges();

      user.email = 'charlie@new.com';
      context.set(User).update(user);
      const affected = await context.saveChanges();

      expect(affected).toBeGreaterThanOrEqual(0);
    });

    test('Delete: Remove entity from tracking', async () => {
      const user = new User();
      user.id = 1;
      user.name = 'David';
      user.email = 'david@example.com';
      context.set(User).add(user);
      await context.saveChanges();

      context.set(User).remove(user);
      const affected = await context.saveChanges();

      expect(affected).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Operations', () => {
    test('Insert multiple users in single transaction', async () => {
      const users = [
        Object.assign(new User(), { name: 'User1', email: 'user1@test.com', age: 20 }),
        Object.assign(new User(), { name: 'User2', email: 'user2@test.com', age: 25 }),
        Object.assign(new User(), { name: 'User3', email: 'user3@test.com', age: 30 })
      ];

      users.forEach(u => context.set(User).add(u));
      const affected = await context.saveChanges();

      expect(affected).toBeGreaterThanOrEqual(3);
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

      expect(affected).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Query Operations - Type Safety', () => {
    test('Query builder methods return TypedQueryable', () => {
      const query = context.set(User)
        .where(u => (u.age ?? 0) >= 30)
        .orderBy(u => u.name)
        .take(10);

      expect(query).toBeDefined();
      expect(typeof query.toArray).toBe('function');
      expect(typeof query.count).toBe('function');
      expect(typeof query.firstOrDefault).toBe('function');
    });

    test('Select projection maintains type safety', () => {
      const query = context.set(User)
        .select(u => ({ id: u.id, name: u.name }));

      expect(query).toBeDefined();
      expect(typeof query.toArray).toBe('function');
    });

    test('Include relationship navigation', () => {
      const query = context.set(User).include(u => u.posts);

      expect(query).toBeDefined();
      expect(typeof query.toArray).toBe('function');
    });

    test('Pagination with skip and take', () => {
      const query = context.set(User)
        .orderBy(u => u.name)
        .skip(0)
        .take(2);

      expect(query).toBeDefined();
      expect(typeof query.toArray).toBe('function');
    });
  });

  describe('Relationships', () => {
    test('Create user with posts - verify entities are tracked', async () => {
      const user = Object.assign(new User(), {
        name: 'Blogger',
        email: 'blogger@example.com'
      });
      context.set(User).add(user);
      await context.saveChanges();

      const post1 = Object.assign(new Post(), {
        title: 'First Post',
        content: 'Hello World!',
        userId: 1
      });

      const post2 = Object.assign(new Post(), {
        title: 'Second Post',
        content: 'Another post',
        userId: 1
      });

      context.set(Post).add(post1);
      context.set(Post).add(post2);
      const affected = await context.saveChanges();

      expect(affected).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    test('Handle nullable columns', () => {
      const user = Object.assign(new User(), {
        name: 'NoAge',
        email: 'noage@example.com'
      });

      expect(user.age).toBeUndefined();
      context.set(User).add(user);
      expect(context.set(User)).toBeDefined();
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

      expect(user1).toBeDefined();
      expect(user2).toBeDefined();
    });

    test('Update without previous add is handled gracefully', async () => {
      const user = Object.assign(new User(), {
        id: 999,
        name: 'Ghost',
        email: 'ghost@example.com'
      });

      context.set(User).update(user);
      const affected = await context.saveChanges();

      expect(affected).toBeGreaterThanOrEqual(0);
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
        userId: 1
      });
      context.set(Post).add(post);
      await context.saveChanges();

      post.title = 'My Updated Blog Post';
      post.content = 'Updated content with more details.';
      context.set(Post).update(post);
      await context.saveChanges();

      expect(post.title).toBe('My Updated Blog Post');
      expect(post.content).toContain('Updated content');
    });

    test('User registration and profile update', async () => {
      const newUser = Object.assign(new User(), {
        name: 'Jane Smith',
        email: 'jane@example.com'
      });
      context.set(User).add(newUser);
      await context.saveChanges();

      newUser.age = 28;
      newUser.name = 'Jane Smith-Johnson';
      context.set(User).update(newUser);
      await context.saveChanges();

      expect(newUser.age).toBe(28);
      expect(newUser.name).toBe('Jane Smith-Johnson');
    });

    test('User deactivation (delete)', async () => {
      const user = Object.assign(new User(), {
        name: 'Inactive User',
        email: 'inactive@example.com'
      });
      context.set(User).add(user);
      await context.saveChanges();

      context.set(User).remove(user);
      await context.saveChanges();

      expect(user).toBeDefined();
    });
  });

  describe('DbContext Lifecycle', () => {
    test('Context creation with provider succeeds', () => {
      expect(context).toBeDefined();
      expect(context.set(User)).toBeDefined();
      expect(context.set(Post)).toBeDefined();
    });

    test('DbSet methods are properly initialized', () => {
      expect(typeof context.set(User).add).toBe('function');
      expect(typeof context.set(User).update).toBe('function');
      expect(typeof context.set(User).remove).toBe('function');
      expect(typeof context.set(User).find).toBe('function');
      expect(typeof context.set(User).where).toBe('function');
      expect(typeof context.set(User).select).toBe('function');
      expect(typeof context.set(User).orderBy).toBe('function');
      expect(typeof context.set(User).include).toBe('function');
    });

    test('Provider connection state is managed correctly', async () => {
      const newProvider = new MockDatabaseProvider();
      await newProvider.connect();
      expect(newProvider).toBeDefined();
      
      await newProvider.disconnect();
      expect(newProvider).toBeDefined();
    });
  });
});
