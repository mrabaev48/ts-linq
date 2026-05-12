import { EntityCache } from '../src/utils/EntityCache';

class User {
  id?: number;
  name?: string;
}

class Product {
  id?: number;
  name?: string;
}

describe('EntityCache', () => {
  let cache: EntityCache;

  beforeEach(() => {
    cache = new EntityCache(100);
  });

  describe('constructor', () => {
    it('should create cache with default maxSize when none provided', () => {
      const defaultCache = new EntityCache();
      expect(defaultCache).toBeInstanceOf(EntityCache);
      expect(defaultCache.size()).toBe(0);
    });

    it('should create cache with custom maxSize', () => {
      const customCache = new EntityCache(50);
      expect(customCache).toBeInstanceOf(EntityCache);
    });

    it('should create cache with logger', () => {
      const mockLogger = { warn: jest.fn() };
      const customCache = new EntityCache(100, mockLogger);
      expect(customCache).toBeInstanceOf(EntityCache);
    });
  });

  describe('set() and get()', () => {
    it('should store and retrieve entity by key', () => {
      const entity = { id: 1, name: 'John' };
      cache.set(User, 1, entity);

      const result = cache.get(User, 1);
      expect(result).toEqual(entity);
      expect(result).toBe(entity);
    });

    it('should return undefined for non-existent key', () => {
      const result = cache.get(User, 999);
      expect(result).toBeUndefined();
    });

    it('should handle different entity types separately', () => {
      const user = { id: 1, name: 'John' };
      const product = { id: 1, name: 'Widget' };

      cache.set(User, 1, user);
      cache.set(Product, 1, product);

      expect(cache.get(User, 1)).toBe(user);
      expect(cache.get(Product, 1)).toBe(product);
    });

    it('should handle string keys', () => {
      const entity = { id: 'abc', name: 'Test' };
      cache.set(User, 'abc', entity);

      expect(cache.get(User, 'abc')).toBe(entity);
    });

    it('should handle composite keys', () => {
      class UserRole {
        userId?: number;
        roleId?: number;
      }
      const entity = { userId: 1, roleId: 2, name: 'Admin' };
      cache.set(UserRole, '1:2', entity);

      expect(cache.get(UserRole, '1:2')).toBe(entity);
    });

    it('should overwrite existing entity with same key', () => {
      const entity1 = { id: 1, name: 'John' };
      const entity2 = { id: 1, name: 'Jane' };

      cache.set(User, 1, entity1);
      cache.set(User, 1, entity2);

      expect(cache.get(User, 1)).toBe(entity2);
    });

    it('should return undefined for null id', () => {
      expect(cache.get(User, null)).toBeUndefined();
    });

    it('should return undefined for undefined id', () => {
      expect(cache.get(User, undefined)).toBeUndefined();
    });

    it('should not store entity with null id', () => {
      cache.set(User, null, { id: null });
      expect(cache.size()).toBe(0);
    });
  });

  describe('remove()', () => {
    it('should remove specific entity', () => {
      cache.set(User, 1, { id: 1 });
      cache.set(User, 2, { id: 2 });

      cache.remove(User, 1);

      expect(cache.get(User, 1)).toBeUndefined();
      expect(cache.get(User, 2)).toBeDefined();
    });

    it('should do nothing for non-existent key', () => {
      expect(() => cache.remove(User, 999)).not.toThrow();
    });

    it('should do nothing for null id', () => {
      cache.set(User, 1, { id: 1 });
      cache.remove(User, null);
      expect(cache.get(User, 1)).toBeDefined();
    });

    it('should decrease cache size after removal', () => {
      cache.set(User, 1, { id: 1 });
      cache.set(User, 2, { id: 2 });
      expect(cache.size()).toBe(2);

      cache.remove(User, 1);
      expect(cache.size()).toBe(1);
    });
  });

  describe('clear()', () => {
    it('should remove all entities from cache', () => {
      cache.set(User, 1, { id: 1 });
      cache.set(User, 2, { id: 2 });
      cache.set(Product, 1, { id: 1 });

      cache.clear();

      expect(cache.get(User, 1)).toBeUndefined();
      expect(cache.get(User, 2)).toBeUndefined();
      expect(cache.get(Product, 1)).toBeUndefined();
    });

    it('should reset size to zero after clear', () => {
      cache.set(User, 1, { id: 1 });
      cache.set(User, 2, { id: 2 });
      cache.clear();

      expect(cache.size()).toBe(0);
    });

    it('should allow adding entities after clear', () => {
      cache.set(User, 1, { id: 1 });
      cache.clear();
      cache.set(User, 2, { id: 2 });

      expect(cache.get(User, 2)).toBeDefined();
      expect(cache.size()).toBe(1);
    });
  });

  describe('size()', () => {
    it('should return zero for empty cache', () => {
      expect(cache.size()).toBe(0);
    });

    it('should return correct size after adding entities', () => {
      cache.set(User, 1, { id: 1 });
      expect(cache.size()).toBe(1);

      cache.set(User, 2, { id: 2 });
      expect(cache.size()).toBe(2);

      cache.set(Product, 1, { id: 1 });
      expect(cache.size()).toBe(3);
    });

    it('should not increase size when overwriting same key', () => {
      cache.set(User, 1, { id: 1, name: 'John' });
      cache.set(User, 1, { id: 1, name: 'Jane' });

      expect(cache.size()).toBe(1);
    });
  });

  describe('FIFO eviction', () => {
    it('should evict oldest entry when maxSize is reached', () => {
      const smallCache = new EntityCache(3);

      smallCache.set(User, 1, { id: 1 });
      smallCache.set(User, 2, { id: 2 });
      smallCache.set(User, 3, { id: 3 });
      smallCache.set(User, 4, { id: 4 });

      expect(smallCache.size()).toBe(3);
      expect(smallCache.get(User, 1)).toBeUndefined();
      expect(smallCache.get(User, 4)).toBeDefined();
    });

    it('should continue evicting as new items are added', () => {
      const smallCache = new EntityCache(2);

      smallCache.set(User, 1, { id: 1 });
      smallCache.set(User, 2, { id: 2 });
      smallCache.set(User, 3, { id: 3 });

      expect(smallCache.size()).toBe(2);
      expect(smallCache.get(User, 1)).toBeUndefined();

      smallCache.set(User, 4, { id: 4 });

      expect(smallCache.size()).toBe(2);
      expect(smallCache.get(User, 2)).toBeUndefined();
    });
  });
});
