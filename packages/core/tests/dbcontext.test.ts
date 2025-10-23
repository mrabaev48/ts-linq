import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DbContext } from '@ts-linq/orm';
import { ProviderStub } from './_stubs/ProviderStub';
import { Entity, Column, PrimaryKey } from '@ts-linq/metadata';

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
}

@Entity()
class Post {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  title!: string;

  @Column({ type: 'INTEGER' })
  userId!: number;
}

class TestDbContext extends DbContext {}

describe('DbContext - Core Functionality', () => {
  let context: TestDbContext;
  let provider: ProviderStub;

  beforeEach(async () => {
    provider = new ProviderStub(':memory:');
    await provider.connect();
    context = new TestDbContext({ provider: provider as any });
    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
    await provider.disconnect();
  });

  describe('Initialization and Setup', () => {
    test('should create DbContext instance', () => {
      expect(context).toBeDefined();
      expect(context).toBeInstanceOf(DbContext);
    });

    test('ensureCreated should initialize database tables', async () => {
      const ctx = new TestDbContext({ provider: provider as any });
      await expect(ctx.ensureCreated()).resolves.not.toThrow();
      await ctx.dispose();
    });

    test('should dispose context properly', async () => {
      const ctx = new TestDbContext({ provider: provider as any });
      await ctx.ensureCreated();
      await expect(ctx.dispose()).resolves.not.toThrow();
    });
  });

  describe('DbSet Access', () => {
    test('should return DbSet for registered entity', () => {
      const userDbSet = context.set(User);
      expect(userDbSet).toBeDefined();
      expect(userDbSet._entityClass).toBe(User);
    });

    test('should return DbSet for multiple entities', () => {
      const userSet = context.set(User);
      const postSet = context.set(Post);
      
      expect(userSet).toBeDefined();
      expect(postSet).toBeDefined();
      expect(userSet._entityClass).toBe(User);
      expect(postSet._entityClass).toBe(Post);
    });

    test('should throw for unregistered entity', () => {
      class UnregisteredEntity {}
      expect(() => context.set(UnregisteredEntity as any)).toThrow();
    });

    test('should cache DbSet instances', () => {
      const set1 = context.set(User);
      const set2 = context.set(User);
      expect(set1).toBe(set2);
    });
  });

  describe('CRUD Operations via saveChanges', () => {
    test('should persist added entities', async () => {
      const user = new User();
      user.name = 'John Doe';
      user.email = 'john@example.com';
      user.age = 30;

      context.set(User).add(user);
      const affectedRows = await context.saveChanges();

      expect(affectedRows).toBeGreaterThanOrEqual(1);
      expect(user.id).toBeDefined();
      expect(user.id).toBeGreaterThan(0);
    });

    test('should persist multiple added entities', async () => {
      const user1 = Object.assign(new User(), { 
        name: 'Alice', 
        email: 'alice@test.com' 
      });
      const user2 = Object.assign(new User(), { 
        name: 'Bob', 
        email: 'bob@test.com' 
      });

      context.set(User).add(user1);
      context.set(User).add(user2);
      const affectedRows = await context.saveChanges();

      expect(affectedRows).toBe(2);
      expect(user1.id).toBeGreaterThan(0);
      expect(user2.id).toBeGreaterThan(0);
    });

    test('should persist updated entities', async () => {
      const user = new User();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      context.set(User).add(user);
      await context.saveChanges();

      const originalId = user.id;
      user.name = 'John Updated';
      user.email = 'john.updated@example.com';
      context.set(User).update(user);
      const affectedRows = await context.saveChanges();

      expect(affectedRows).toBe(1);
      expect(user.id).toBe(originalId);

      const found = await context.set(User).find(user.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('John Updated');
      expect(found!.email).toBe('john.updated@example.com');
    });

    test('should delete removed entities', async () => {
      const user = new User();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      context.set(User).add(user);
      await context.saveChanges();

      const userId = user.id;
      context.set(User).remove(user);
      const affectedRows = await context.saveChanges();

      expect(affectedRows).toBe(1);

      const found = await context.set(User).find(userId);
      expect(found).toBeNull();
    });

    test('should handle mixed operations in single saveChanges', async () => {
      const user1 = Object.assign(new User(), { 
        name: 'User1', 
        email: 'user1@test.com' 
      });
      const user2 = Object.assign(new User(), { 
        name: 'User2', 
        email: 'user2@test.com' 
      });
      
      context.set(User).add(user1);
      context.set(User).add(user2);
      await context.saveChanges();

      user1.name = 'UpdatedUser1';
      context.set(User).update(user1);

      const user3 = Object.assign(new User(), { 
        name: 'User3', 
        email: 'user3@test.com' 
      });
      context.set(User).add(user3);

      context.set(User).remove(user2);

      const affectedRows = await context.saveChanges();
      expect(affectedRows).toBe(3);

      const all = await context.set(User).toArray();
      expect(all).toHaveLength(2);
      expect(all.find(u => u.name === 'UpdatedUser1')).toBeDefined();
      expect(all.find(u => u.name === 'User3')).toBeDefined();
      expect(all.find(u => u.name === 'User2')).toBeUndefined();
    });
  });

  describe('Transactions', () => {
    test('should handle empty saveChanges', async () => {
      const affectedRows = await context.saveChanges();
      expect(affectedRows).toBe(0);
    });

    test('should allow multiple consecutive saveChanges', async () => {
      const user1 = Object.assign(new User(), { 
        name: 'User1', 
        email: 'user1@test.com' 
      });
      context.set(User).add(user1);
      await context.saveChanges();

      const user2 = Object.assign(new User(), { 
        name: 'User2', 
        email: 'user2@test.com' 
      });
      context.set(User).add(user2);
      await context.saveChanges();

      const users = await context.set(User).toArray();
      expect(users).toHaveLength(2);
    });
  });

  describe('Entity Tracking', () => {
    test('should track newly added entities', async () => {
      const user = Object.assign(new User(), {
        name: 'Tracked',
        email: 'tracked@test.com'
      });
      
      context.set(User).add(user);
      expect(context._changeTracker.getState(user)).toBe('Added');
    });

    test('should track modified entities', async () => {
      const user = Object.assign(new User(), {
        name: 'Original',
        email: 'original@test.com'
      });
      
      context.set(User).add(user);
      await context.saveChanges();

      user.name = 'Modified';
      context.set(User).update(user);
      expect(context._changeTracker.getState(user)).toBe('Modified');
    });

    test('should track deleted entities', async () => {
      const user = Object.assign(new User(), {
        name: 'ToDelete',
        email: 'delete@test.com'
      });
      
      context.set(User).add(user);
      await context.saveChanges();

      context.set(User).remove(user);
      expect(context._changeTracker.getState(user)).toBe('Deleted');
    });

    test('should clear tracking after saveChanges', async () => {
      const user = Object.assign(new User(), {
        name: 'Test',
        email: 'test@test.com'
      });
      
      context.set(User).add(user);
      await context.saveChanges();

      expect(context._changeTracker.getState(user)).toBe('Unchanged');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const users = [
        Object.assign(new User(), { name: 'Alice', email: 'alice@test.com', age: 30 }),
        Object.assign(new User(), { name: 'Bob', email: 'bob@test.com', age: 25 }),
        Object.assign(new User(), { name: 'Charlie', email: 'charlie@test.com', age: 35 })
      ];
      users.forEach(u => context.set(User).add(u));
      await context.saveChanges();
    });

    test('should query all entities', async () => {
      const users = await context.set(User).toArray();
      expect(users.length).toBeGreaterThanOrEqual(3);
    });

    test('should find entity by ID', async () => {
      const users = await context.set(User).toArray();
      const firstUser = users[0];
      
      const found = await context.set(User).find(firstUser.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(firstUser.id);
      expect(found!.name).toBe(firstUser.name);
    });

    test('should return null for non-existent ID', async () => {
      const found = await context.set(User).find(99999);
      expect(found).toBeNull();
    });

    test('should filter entities with where clause', async () => {
      const adults = await context.set(User)
        .where(u => (u.age ?? 0) >= 30)
        .toArray();

      expect(adults.length).toBeGreaterThanOrEqual(2);
      adults.forEach(u => {
        expect(u.age).toBeGreaterThanOrEqual(30);
      });
    });

    test('should count entities', async () => {
      const count = await context.set(User).count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should get first entity', async () => {
      const first = await context.set(User).firstOrDefault();
      expect(first).toBeDefined();
      expect(first).toBeInstanceOf(User);
    });
  });

  describe('Edge Cases', () => {
    test('should handle nullable columns', async () => {
      const user = Object.assign(new User(), {
        name: 'NoAge',
        email: 'noage@test.com'
      });

      context.set(User).add(user);
      await context.saveChanges();

      const found = await context.set(User).find(user.id);
      expect(found?.age).toBeUndefined();
    });

    test('should handle entity with all required fields', async () => {
      const user = Object.assign(new User(), {
        name: 'Complete',
        email: 'complete@test.com',
        age: 42
      });

      context.set(User).add(user);
      await context.saveChanges();

      const found = await context.set(User).find(user.id);
      expect(found?.name).toBe('Complete');
      expect(found?.email).toBe('complete@test.com');
      expect(found?.age).toBe(42);
    });
  });
});
