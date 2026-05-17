import { describe, expect, it } from '@jest/globals';

import { CachePolicy, getCachePolicy } from '../src/CachePolicy';

class Product {
  id!: number;
  name!: string;
}

class Category {
  id!: number;
  name!: string;
}

class Review {
  id!: number;
  productId!: number;
}

class Uncached {
  id!: number;
}

function applyDecorator<T extends Function>(target: T, decorator: any): void {
  const mockContext = {
    kind: 'class',
    name: target.name,
    addInitializer: (fn: () => void) => {}
  };
  decorator(target, mockContext);
}

describe('CachePolicy', () => {
  describe('decorator metadata storage', () => {
    it('should store cache policy metadata', () => {
      applyDecorator(Product, CachePolicy({ ttl: 300, invalidateOn: ['User', 'Order'] }));

      const policy = getCachePolicy(Product);

      expect(policy).toBeDefined();
      expect(policy?.ttl).toBe(300);
      expect(policy?.invalidateOn).toEqual(['User', 'Order']);
    });

    it('should support ttl-only policy', () => {
      applyDecorator(Category, CachePolicy({ ttl: 600 }));

      const policy = getCachePolicy(Category);

      expect(policy).toBeDefined();
      expect(policy?.ttl).toBe(600);
      expect(policy?.invalidateOn).toBeUndefined();
    });

    it('should support invalidateOn-only policy', () => {
      applyDecorator(Review, CachePolicy({ invalidateOn: ['Product'] }));

      const policy = getCachePolicy(Review);

      expect(policy).toBeDefined();
      expect(policy?.ttl).toBeUndefined();
      expect(policy?.invalidateOn).toEqual(['Product']);
    });

    it('should return undefined for entities without cache policy', () => {
      const policy = getCachePolicy(Uncached);

      expect(policy).toBeUndefined();
    });
  });

  describe('policy isolation', () => {
    it('should isolate policies between different entities', () => {
      class Entity1 {
        id!: number;
      }
      class Entity2 {
        id!: number;
      }

      applyDecorator(Entity1, CachePolicy({ ttl: 300 }));
      applyDecorator(Entity2, CachePolicy({ ttl: 600 }));

      const policy1 = getCachePolicy(Entity1);
      const policy2 = getCachePolicy(Entity2);

      expect(policy1?.ttl).toBe(300);
      expect(policy2?.ttl).toBe(600);
      expect(policy1).not.toBe(policy2);
    });
  });

  describe('Stage-3 decorator compatibility', () => {
    it('should work with Stage-3 decorator context', () => {
      class TestEntity {
        id!: number;
      }

      expect(() => {
        applyDecorator(TestEntity, CachePolicy({ ttl: 100 }));
        const policy = getCachePolicy(TestEntity);
        expect(policy?.ttl).toBe(100);
      }).not.toThrow();
    });

    it('should store policy with spread operator', () => {
      class TestEntity {
        id!: number;
      }

      applyDecorator(TestEntity, CachePolicy({ ttl: 300, invalidateOn: ['User', 'Order'] }));

      const policy = getCachePolicy(TestEntity);

      expect(policy).toBeDefined();
      expect(policy?.ttl).toBe(300);
      expect(policy?.invalidateOn).toEqual(['User', 'Order']);
    });

    it('should throw error for non-Stage-3 context', () => {
      class TestEntity {
        id!: number;
      }

      const decorator = CachePolicy({ ttl: 100 });

      expect(() => {
        decorator(TestEntity);
      }).toThrow('@CachePolicy requires TS5 Stage-3 decorators');
    });
  });

  describe('invalidation dependencies', () => {
    it('should support readonly array of entity names', () => {
      class TestEntity {
        id!: number;
      }
      const dependencies: ReadonlyArray<string> = ['User', 'Order'];

      applyDecorator(TestEntity, CachePolicy({ invalidateOn: dependencies }));

      const policy = getCachePolicy(TestEntity);
      expect(policy?.invalidateOn).toEqual(['User', 'Order']);
    });

    it('should support empty invalidation list', () => {
      class TestEntity {
        id!: number;
      }

      applyDecorator(TestEntity, CachePolicy({ invalidateOn: [] }));

      const policy = getCachePolicy(TestEntity);
      expect(policy?.invalidateOn).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle zero TTL', () => {
      class TestEntity {
        id!: number;
      }

      applyDecorator(TestEntity, CachePolicy({ ttl: 0 }));

      const policy = getCachePolicy(TestEntity);
      expect(policy?.ttl).toBe(0);
    });

    it('should handle very large TTL', () => {
      class TestEntity {
        id!: number;
      }

      applyDecorator(TestEntity, CachePolicy({ ttl: 86400 * 365 }));

      const policy = getCachePolicy(TestEntity);
      expect(policy?.ttl).toBe(86400 * 365);
    });

    it('should handle empty options', () => {
      class TestEntity {
        id!: number;
      }

      applyDecorator(TestEntity, CachePolicy({}));

      const policy = getCachePolicy(TestEntity);
      expect(policy).toBeDefined();
      expect(policy?.ttl).toBeUndefined();
      expect(policy?.invalidateOn).toBeUndefined();
    });
  });
});
