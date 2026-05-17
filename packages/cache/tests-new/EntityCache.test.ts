import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { EntityCacheLike } from '../src/EntityCache';
import { EntityCache } from '../src/EntityCache';

class User {
  constructor(
    public id: number,
    public name: string
  ) {}
}

class Post {
  constructor(
    public id: string,
    public title: string
  ) {}
}

describe('EntityCache', () => {
  let cache: EntityCache;

  beforeEach(() => {
    cache = new EntityCache(5);
  });

  describe('contract compliance', () => {
    it('should implement EntityCacheLike interface', () => {
      const cacheLike: EntityCacheLike = cache;

      expect(typeof cacheLike.get).toBe('function');
      expect(typeof cacheLike.set).toBe('function');
      expect(typeof cacheLike.remove).toBe('function');
      expect(typeof cacheLike.clear).toBe('function');
      expect(typeof cacheLike.size).toBe('function');
    });

    it('should support basic cache operations', () => {
      const user = new User(1, 'Alice');

      cache.set(User, 1, user);
      expect(cache.get<User>(User, 1)).toBe(user);

      cache.remove(User, 1);
      expect(cache.get<User>(User, 1)).toBeUndefined();
    });
  });

  describe('FIFO eviction', () => {
    it('should evict oldest entry when maxSize reached', () => {
      for (let i = 1; i <= 5; i++) {
        cache.set(User, i, new User(i, `User${i}`));
      }

      expect(cache.size()).toBe(5);
      expect(cache.get<User>(User, 1)).toBeDefined();

      cache.set(User, 6, new User(6, 'User6'));

      expect(cache.size()).toBe(5);
      expect(cache.get<User>(User, 1)).toBeUndefined();
      expect(cache.get<User>(User, 6)).toBeDefined();
    });

    it('should maintain FIFO order across multiple evictions', () => {
      for (let i = 1; i <= 5; i++) {
        cache.set(User, i, new User(i, `User${i}`));
      }

      cache.set(User, 6, new User(6, 'User6'));
      cache.set(User, 7, new User(7, 'User7'));
      cache.set(User, 8, new User(8, 'User8'));

      expect(cache.get<User>(User, 1)).toBeUndefined();
      expect(cache.get<User>(User, 2)).toBeUndefined();
      expect(cache.get<User>(User, 3)).toBeUndefined();
      expect(cache.get<User>(User, 4)).toBeDefined();
      expect(cache.get<User>(User, 8)).toBeDefined();
    });

    it('should respect custom maxSize', () => {
      const smallCache = new EntityCache(2);

      smallCache.set(User, 1, new User(1, 'User1'));
      smallCache.set(User, 2, new User(2, 'User2'));
      smallCache.set(User, 3, new User(3, 'User3'));

      expect(smallCache.size()).toBe(2);
      expect(smallCache.get<User>(User, 1)).toBeUndefined();
    });
  });

  describe('cross-entity isolation', () => {
    it('should isolate cache entries by entity type', () => {
      const user = new User(1, 'Alice');
      const post = new Post('1', 'Hello');

      cache.set(User, 1, user);
      cache.set(Post, '1', post);

      expect(cache.get<User>(User, 1)).toBe(user);
      expect(cache.get<Post>(Post, '1')).toBe(post);
      expect(cache.size()).toBe(2);
    });

    it('should handle eviction across different entity types', () => {
      cache.set(User, 1, new User(1, 'User1'));
      cache.set(Post, 'p1', new Post('p1', 'Post1'));
      cache.set(User, 2, new User(2, 'User2'));
      cache.set(Post, 'p2', new Post('p2', 'Post2'));
      cache.set(User, 3, new User(3, 'User3'));
      cache.set(User, 4, new User(4, 'User4'));

      expect(cache.size()).toBe(5);
      expect(cache.get<User>(User, 1)).toBeUndefined();
      expect(cache.get<Post>(Post, 'p1')).toBeDefined();
    });
  });

  describe('metrics hook resilience', () => {
    it('should handle eviction with logger without throwing', () => {
      const mockLogger = { log: jest.fn() };
      const cacheWithLogger = new EntityCache(2, mockLogger, 'test-provider');

      cacheWithLogger.set(User, 1, new User(1, 'User1'));
      cacheWithLogger.set(User, 2, new User(2, 'User2'));

      expect(() => {
        cacheWithLogger.set(User, 3, new User(3, 'User3'));
      }).not.toThrow();

      expect(cacheWithLogger.size()).toBe(2);
    });

    it('should continue operation if metrics logging fails', () => {
      const failingLogger = {
        log: () => {
          throw new Error('Logger failed');
        }
      };
      const cacheWithFailingLogger = new EntityCache(2, failingLogger, 'test');

      cacheWithFailingLogger.set(User, 1, new User(1, 'User1'));
      cacheWithFailingLogger.set(User, 2, new User(2, 'User2'));

      expect(() => {
        cacheWithFailingLogger.set(User, 3, new User(3, 'User3'));
      }).not.toThrow();

      expect(cacheWithFailingLogger.get<User>(User, 3)).toBeDefined();
    });
  });

  describe('null/undefined safety', () => {
    it('should ignore null IDs in set/get/remove', () => {
      const user = new User(1, 'Alice');

      cache.set(User, null, user);
      expect(cache.size()).toBe(0);

      expect(cache.get(User, null)).toBeUndefined();

      cache.set(User, 1, user);
      cache.remove(User, null);
      expect(cache.size()).toBe(1);
    });

    it('should ignore undefined IDs in set/get/remove', () => {
      const user = new User(1, 'Alice');

      cache.set(User, undefined, user);
      expect(cache.size()).toBe(0);

      expect(cache.get(User, undefined)).toBeUndefined();

      cache.set(User, 1, user);
      cache.remove(User, undefined);
      expect(cache.size()).toBe(1);
    });
  });

  describe('clear()', () => {
    it('should remove all entries across entity types', () => {
      cache.set(User, 1, new User(1, 'Alice'));
      cache.set(User, 2, new User(2, 'Bob'));
      cache.set(Post, 'p1', new Post('p1', 'Hello'));

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get<User>(User, 1)).toBeUndefined();
      expect(cache.get<Post>(Post, 'p1')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle zero as ID', () => {
      const user = new User(0, 'Zero');
      cache.set(User, 0, user);

      expect(cache.get<User>(User, 0)).toBe(user);
    });

    it('should handle empty string as ID', () => {
      const post = new Post('', 'Empty');
      cache.set(Post, '', post);

      expect(cache.get<Post>(Post, '')).toBe(post);
    });

    it('should handle entity replacement at same key', () => {
      const user1 = new User(1, 'Alice');
      const user2 = new User(1, 'Alice Updated');

      cache.set(User, 1, user1);
      cache.set(User, 1, user2);

      expect(cache.get<User>(User, 1)).toBe(user2);
      expect(cache.size()).toBe(1);
    });
  });
});
