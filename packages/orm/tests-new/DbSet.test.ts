import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DbSet } from '../src/DbSet';
import { ChangeTracker } from '../src/ChangeTracker';
import { EntityState, type DatabaseProvider } from '@ts-linq/core';
import { Entity, PrimaryKey, Column, MetadataStorage } from '@ts-linq/metadata';

@Entity({ name: 'users' })
class User {
  @PrimaryKey()
  @Column()
  id!: number;

  @Column()
  name!: string;

  @Column()
  email!: string;
}

@Entity({ name: 'products' })
class Product {
  @PrimaryKey()
  @Column()
  id!: number;

  @Column()
  title!: string;

  @Column()
  price!: number;
}

describe('DbSet', () => {
  let dbSet: DbSet<User>;
  let changeTracker: ChangeTracker;
  let mockProvider: DatabaseProvider;

  beforeEach(() => {
    changeTracker = new ChangeTracker();

    mockProvider = {
      findById: jest.fn(),
      findWhereIn: jest.fn(),
      query: jest.fn(),
      execute: jest.fn(),
      executeTransaction: jest.fn(),
      rawQuery: jest.fn(),
      providerLabel: 'MockProvider',
      loggerRef: undefined
    } as any;

    dbSet = new DbSet(User, { provider: mockProvider, changeTracker });
  });

  describe('constructor', () => {
    it('should create DbSet with required parameters', () => {
      expect(dbSet).toBeDefined();
      expect(dbSet.entityClass).toBe(User);
    });

    it('should create DbSet for different entity types', () => {
      const productSet = new DbSet(Product, { provider: mockProvider, changeTracker });
      expect(productSet.entityClass).toBe(Product);
    });
  });

  describe('add()', () => {
    it('should add entity to change tracker as Added', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      const result = dbSet.add(user);

      expect(result).toBe(user);
      expect(changeTracker.getEntityState(user)).toBe(EntityState.Added);
    });

    it('should return the same entity instance', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      const result = dbSet.add(user);

      expect(result).toBe(user);
    });

    it('should add multiple different entities', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });

      dbSet.add(user1);
      dbSet.add(user2);

      expect(changeTracker.getEntityState(user1)).toBe(EntityState.Added);
      expect(changeTracker.getEntityState(user2)).toBe(EntityState.Added);
      expect(changeTracker.getChanges()).toHaveLength(2);
    });

    it('should work with entities having zero/null values', () => {
      const user = Object.assign(new User(), { id: 0, name: '', email: null as any });

      dbSet.add(user);

      expect(changeTracker.getEntityState(user)).toBe(EntityState.Added);
    });
  });

  describe('update()', () => {
    it('should mark entity as Modified', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      const result = dbSet.update(user);

      expect(result).toBe(user);
      expect(changeTracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should return the same entity instance', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      const result = dbSet.update(user);

      expect(result).toBe(user);
    });

    it('should update multiple entities', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });

      dbSet.update(user1);
      dbSet.update(user2);

      expect(changeTracker.getChanges()).toHaveLength(2);
    });

    it('should transition Added entity to Modified', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      dbSet.add(user);
      dbSet.update(user);

      expect(changeTracker.getEntityState(user)).toBe(EntityState.Modified);
    });
  });

  describe('remove()', () => {
    it('should mark entity as Deleted', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      const result = dbSet.remove(user);

      expect(result).toBe(user);
      expect(changeTracker.getEntityState(user)).toBe(EntityState.Deleted);
    });

    it('should return the same entity instance', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      const result = dbSet.remove(user);

      expect(result).toBe(user);
    });

    it('should remove multiple entities', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });

      dbSet.remove(user1);
      dbSet.remove(user2);

      const changes = changeTracker.getChanges();
      expect(changes).toHaveLength(2);
      expect(changes.every((c) => c.state === EntityState.Deleted)).toBe(true);
    });

    it('should transition Added entity to Deleted', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      dbSet.add(user);
      dbSet.remove(user);

      expect(changeTracker.getEntityState(user)).toBe(EntityState.Deleted);
    });
  });

  describe('addRange()', () => {
    it('should add multiple entities at once', () => {
      const users = [
        Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' }),
        Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' }),
        Object.assign(new User(), { id: 3, name: 'Bob', email: 'bob@test.com' })
      ];

      const result = dbSet.addRange(users);

      expect(result).toBe(users);
      expect(changeTracker.getChanges()).toHaveLength(3);
      users.forEach((user) => {
        expect(changeTracker.getEntityState(user)).toBe(EntityState.Added);
      });
    });

    it('should handle empty array', () => {
      const result = dbSet.addRange([]);

      expect(result).toEqual([]);
      expect(changeTracker.getChanges()).toHaveLength(0);
    });

    it('should handle single entity array', () => {
      const users = [Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' })];

      dbSet.addRange(users);

      expect(changeTracker.getChanges()).toHaveLength(1);
    });
  });

  describe('updateRange()', () => {
    it('should update multiple entities at once', () => {
      const users = [
        Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' }),
        Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' }),
        Object.assign(new User(), { id: 3, name: 'Bob', email: 'bob@test.com' })
      ];

      const result = dbSet.updateRange(users);

      expect(result).toBe(users);
      expect(changeTracker.getChanges()).toHaveLength(3);
      users.forEach((user) => {
        expect(changeTracker.getEntityState(user)).toBe(EntityState.Modified);
      });
    });

    it('should handle empty array', () => {
      const result = dbSet.updateRange([]);

      expect(result).toEqual([]);
      expect(changeTracker.getChanges()).toHaveLength(0);
    });
  });

  describe('removeRange()', () => {
    it('should remove multiple entities at once', () => {
      const users = [
        Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' }),
        Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' }),
        Object.assign(new User(), { id: 3, name: 'Bob', email: 'bob@test.com' })
      ];

      const result = dbSet.removeRange(users);

      expect(result).toBe(users);
      expect(changeTracker.getChanges()).toHaveLength(3);
      users.forEach((user) => {
        expect(changeTracker.getEntityState(user)).toBe(EntityState.Deleted);
      });
    });

    it('should handle empty array', () => {
      const result = dbSet.removeRange([]);

      expect(result).toEqual([]);
      expect(changeTracker.getChanges()).toHaveLength(0);
    });
  });

  describe('findByIds()', () => {
    it('should return empty array for empty ids', async () => {
      const result = await dbSet.findByIds([]);

      expect(result).toEqual([]);
      expect(mockProvider.findWhereIn).not.toHaveBeenCalled();
    });

    it('should use provider.findWhereIn for batch lookup', async () => {
      const users = [
        Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' }),
        Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' })
      ];
      (mockProvider.findWhereIn as any).mockResolvedValue(users);

      const result = await dbSet.findByIds([1, 2]);

      expect(result).toEqual(users);
    });

    it('should deduplicate ids', async () => {
      const users = [Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' })];
      (mockProvider.findWhereIn as any).mockResolvedValue(users);

      await dbSet.findByIds([1, 1, 1]);

      expect(mockProvider.findWhereIn).toHaveBeenCalledTimes(1);
    });

    it('should handle null ids gracefully', async () => {
      const result = await dbSet.findByIds(null as any);

      expect(result).toEqual([]);
    });
  });

  describe('cross-entity scenarios', () => {
    it('should track entities of different types separately', () => {
      const productSet = new DbSet(Product, { provider: mockProvider, changeTracker });

      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const product = Object.assign(new Product(), { id: 1, title: 'Widget', price: 9.99 });

      dbSet.add(user);
      productSet.add(product);

      expect(changeTracker.getChanges()).toHaveLength(2);
    });

    it('should allow same ChangeTracker for multiple DbSets', () => {
      const productSet = new DbSet(Product, { provider: mockProvider, changeTracker });

      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const product = Object.assign(new Product(), { id: 1, title: 'Widget', price: 9.99 });

      dbSet.add(user);
      productSet.remove(product);

      const changes = changeTracker.getChanges();
      expect(changes).toHaveLength(2);
      expect(changes.find((c) => c.entity === user)?.state).toBe(EntityState.Added);
      expect(changes.find((c) => c.entity === product)?.state).toBe(EntityState.Deleted);
    });
  });

  describe('integration with ChangeTracker', () => {
    it('should reflect state changes through ChangeTracker', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      dbSet.add(user);
      expect(changeTracker.getEntityState(user)).toBe(EntityState.Added);

      dbSet.update(user);
      expect(changeTracker.getEntityState(user)).toBe(EntityState.Modified);

      dbSet.remove(user);
      expect(changeTracker.getEntityState(user)).toBe(EntityState.Deleted);
    });

    it('should accumulate changes in ChangeTracker', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });
      const user3 = Object.assign(new User(), { id: 3, name: 'Bob', email: 'bob@test.com' });

      dbSet.add(user1);
      dbSet.update(user2);
      dbSet.remove(user3);

      const changes = changeTracker.getChanges();
      expect(changes).toHaveLength(3);

      const addedCount = changes.filter((c) => c.state === EntityState.Added).length;
      const modifiedCount = changes.filter((c) => c.state === EntityState.Modified).length;
      const deletedCount = changes.filter((c) => c.state === EntityState.Deleted).length;

      expect(addedCount).toBe(1);
      expect(modifiedCount).toBe(1);
      expect(deletedCount).toBe(1);
    });
  });
});
