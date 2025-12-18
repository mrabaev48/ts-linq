jest.mock('@ts-linq/metrics-safe', () => ({
  safeCacheEvicted: jest.fn()
}));

import { EntityCache } from '../src/EntityCache';

class TestEntity {
  id: number;
  name: string;
  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}

class OtherEntity {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}

describe('EntityCache', () => {
  describe('Constructor', () => {
    it('should create cache with default max size', () => {
      const cache = new EntityCache();
      expect(cache).toBeDefined();
      expect(cache.size()).toBe(0);
    });

    it('should create cache with custom max size', () => {
      const cache = new EntityCache(100);
      expect(cache).toBeDefined();
    });

    it('should create cache with logger and provider label', () => {
      const mockLogger = {};
      const cache = new EntityCache(100, mockLogger, 'postgresql');
      expect(cache).toBeDefined();
    });
  });

  describe('get()', () => {
    let cache: EntityCache;

    beforeEach(() => {
      cache = new EntityCache(100);
    });

    it('should return undefined for non-existent entity', () => {
      const result = cache.get<TestEntity>(TestEntity, 1);
      expect(result).toBeUndefined();
    });

    it('should return undefined for null id', () => {
      const result = cache.get<TestEntity>(TestEntity, null);
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined id', () => {
      const result = cache.get<TestEntity>(TestEntity, undefined);
      expect(result).toBeUndefined();
    });

    it('should return cached entity by id', () => {
      const entity = new TestEntity(1, 'Test');
      cache.set(TestEntity, 1, entity);
      
      const result = cache.get<TestEntity>(TestEntity, 1);
      expect(result).toBe(entity);
    });

    it('should differentiate entities by class', () => {
      const testEntity = new TestEntity(1, 'Test');
      const otherEntity = new OtherEntity('1');
      
      cache.set(TestEntity, 1, testEntity);
      cache.set(OtherEntity, '1', otherEntity);
      
      expect(cache.get<TestEntity>(TestEntity, 1)).toBe(testEntity);
      expect(cache.get<OtherEntity>(OtherEntity, '1')).toBe(otherEntity);
    });
  });

  describe('set()', () => {
    let cache: EntityCache;

    beforeEach(() => {
      cache = new EntityCache(100);
    });

    it('should add entity to cache', () => {
      const entity = new TestEntity(1, 'Test');
      cache.set(TestEntity, 1, entity);
      
      expect(cache.size()).toBe(1);
      expect(cache.get<TestEntity>(TestEntity, 1)).toBe(entity);
    });

    it('should not add entity with null id', () => {
      const entity = new TestEntity(1, 'Test');
      cache.set(TestEntity, null, entity);
      
      expect(cache.size()).toBe(0);
    });

    it('should not add entity with undefined id', () => {
      const entity = new TestEntity(1, 'Test');
      cache.set(TestEntity, undefined, entity);
      
      expect(cache.size()).toBe(0);
    });

    it('should update existing entity', () => {
      const entity1 = new TestEntity(1, 'Test1');
      const entity2 = new TestEntity(1, 'Test2');
      
      cache.set(TestEntity, 1, entity1);
      cache.set(TestEntity, 1, entity2);
      
      expect(cache.size()).toBe(1);
      expect(cache.get<TestEntity>(TestEntity, 1)).toBe(entity2);
    });

    it('should handle string ids', () => {
      const entity = new OtherEntity('abc-123');
      cache.set(OtherEntity, 'abc-123', entity);
      
      expect(cache.get<OtherEntity>(OtherEntity, 'abc-123')).toBe(entity);
    });
  });

  describe('FIFO Eviction', () => {
    it('should evict oldest entry when max size exceeded', () => {
      const cache = new EntityCache(3);
      
      cache.set(TestEntity, 1, new TestEntity(1, 'First'));
      cache.set(TestEntity, 2, new TestEntity(2, 'Second'));
      cache.set(TestEntity, 3, new TestEntity(3, 'Third'));
      cache.set(TestEntity, 4, new TestEntity(4, 'Fourth'));
      
      expect(cache.size()).toBe(3);
      expect(cache.get<TestEntity>(TestEntity, 1)).toBeUndefined();
      expect(cache.get<TestEntity>(TestEntity, 2)).toBeDefined();
      expect(cache.get<TestEntity>(TestEntity, 3)).toBeDefined();
      expect(cache.get<TestEntity>(TestEntity, 4)).toBeDefined();
    });

    it('should evict multiple entries when adding many items', () => {
      const cache = new EntityCache(2);
      
      cache.set(TestEntity, 1, new TestEntity(1, 'A'));
      cache.set(TestEntity, 2, new TestEntity(2, 'B'));
      cache.set(TestEntity, 3, new TestEntity(3, 'C'));
      cache.set(TestEntity, 4, new TestEntity(4, 'D'));
      
      expect(cache.size()).toBe(2);
      expect(cache.get<TestEntity>(TestEntity, 3)).toBeDefined();
      expect(cache.get<TestEntity>(TestEntity, 4)).toBeDefined();
    });
  });

  describe('remove()', () => {
    let cache: EntityCache;

    beforeEach(() => {
      cache = new EntityCache(100);
    });

    it('should remove entity from cache', () => {
      const entity = new TestEntity(1, 'Test');
      cache.set(TestEntity, 1, entity);
      
      cache.remove(TestEntity, 1);
      
      expect(cache.size()).toBe(0);
      expect(cache.get<TestEntity>(TestEntity, 1)).toBeUndefined();
    });

    it('should not throw when removing non-existent entity', () => {
      expect(() => cache.remove(TestEntity, 999)).not.toThrow();
    });

    it('should not throw when removing with null id', () => {
      expect(() => cache.remove(TestEntity, null)).not.toThrow();
    });

    it('should not throw when removing with undefined id', () => {
      expect(() => cache.remove(TestEntity, undefined)).not.toThrow();
    });
  });

  describe('clear()', () => {
    it('should remove all entities from cache', () => {
      const cache = new EntityCache(100);
      
      cache.set(TestEntity, 1, new TestEntity(1, 'A'));
      cache.set(TestEntity, 2, new TestEntity(2, 'B'));
      cache.set(OtherEntity, 'x', new OtherEntity('x'));
      
      expect(cache.size()).toBe(3);
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
    });

    it('should not throw on empty cache', () => {
      const cache = new EntityCache(100);
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('size()', () => {
    it('should return 0 for empty cache', () => {
      const cache = new EntityCache(100);
      expect(cache.size()).toBe(0);
    });

    it('should return correct count after operations', () => {
      const cache = new EntityCache(100);
      
      cache.set(TestEntity, 1, new TestEntity(1, 'A'));
      expect(cache.size()).toBe(1);
      
      cache.set(TestEntity, 2, new TestEntity(2, 'B'));
      expect(cache.size()).toBe(2);
      
      cache.remove(TestEntity, 1);
      expect(cache.size()).toBe(1);
      
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });
});
