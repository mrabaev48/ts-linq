import { LazyLoadingProxy, isLazyProxy, getLazyTarget, awaitLazyLoad, LAZY_LOADING_PROXY } from './LazyLoadingProxy';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { DatabaseProvider } from '../DatabaseProvider';
import type { ColumnMetadata, RelationshipMetadata } from '../types';

// Test entities
class User {
  id!: number;
  name!: string;
  posts!: Post[];
}

class Post {
  id!: number;
  title!: string;
  userId!: number; // keep as number for type compatibility
  user!: User | null;
}

describe('LazyLoadingProxy', () => {
  let mockProvider: jest.Mocked<DatabaseProvider>;

  beforeEach(() => {
    // Clear metadata before each test
    MetadataStorage.getInstance().clear();
    
    // Re-register entities manually
    MetadataStorage.addEntity(User, 'users');
    const userIdCol: ColumnMetadata = { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false };
    const userNameCol: ColumnMetadata = { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false };
    MetadataStorage.addColumn(User, userIdCol);
    MetadataStorage.addColumn(User, userNameCol);
    MetadataStorage.addPrimaryKey(User, 'id');
    const userPostsRel: RelationshipMetadata = {
      type: 'one-to-many',
      propertyName: 'posts',
      targetEntity: () => Post,
      foreignKey: 'userId',
      inverseSide: 'user'
    };
    MetadataStorage.addRelationship(User, userPostsRel);

    MetadataStorage.addEntity(Post, 'posts');
    const postIdCol: ColumnMetadata = { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false };
    const postTitleCol: ColumnMetadata = { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false };
    const postUserIdCol: ColumnMetadata = { propertyName: 'userId', columnName: 'user_id', type: 'INTEGER', nullable: true };
    MetadataStorage.addColumn(Post, postIdCol);
    MetadataStorage.addColumn(Post, postTitleCol);
    MetadataStorage.addColumn(Post, postUserIdCol);
    MetadataStorage.addPrimaryKey(Post, 'id');
    const postUserRel: RelationshipMetadata = {
      type: 'many-to-one',
      propertyName: 'user',
      targetEntity: () => User,
      foreignKey: 'userId'
    };
    MetadataStorage.addRelationship(Post, postUserRel);

    mockProvider = {
      findById: jest.fn(),
      findWhere: jest.fn(),
      findWhereIn: jest.fn(),
      findAll: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      createTable: jest.fn(),
      getDialect: jest.fn() as unknown as DatabaseProvider['getDialect'],
      insert: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      executeQuery: jest.fn(),
      doExecuteQuery: jest.fn(),
      executeNonQuery: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      inTransactionState: false,
      providerLabel: 'test',
      loggerRef: undefined,
      softDeleteOptions: undefined,
      notifyEntityMaterialized: jest.fn(),
      doExecuteNonQuery: jest.fn()
    } as unknown as jest.Mocked<DatabaseProvider>;
  });

  afterEach(async () => {
    // Clear all mocks to prevent resource leaks
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Wait for any pending promises to resolve
    await new Promise(resolve => setImmediate(resolve));
  });

  afterAll(() => {
    // Final cleanup
    MetadataStorage.getInstance().clear();
  });

  describe('Proxy Creation', () => {
    test('should create lazy proxy for entity with relationships', () => {
      const user = { id: 1, name: 'John' };
      const proxy = LazyLoadingProxy.create(user, User, mockProvider);

      expect(isLazyProxy(proxy)).toBe(true);
      expect(proxy.id).toBe(1);
      expect(proxy.name).toBe('John');
    });

    test('should not create proxy for entity without relationships', () => {
      // Create entity without relationships
      class SimpleEntity { id!: number; }
      MetadataStorage.addEntity(SimpleEntity, 'simple');
      const idCol: ColumnMetadata = { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false };
      MetadataStorage.addColumn(SimpleEntity, idCol);
      MetadataStorage.addPrimaryKey(SimpleEntity, 'id');

      const entity = { id: 1 };
      const result = LazyLoadingProxy.create(entity, SimpleEntity, mockProvider);

      expect(result).toBe(entity); // Should return original entity
      expect(isLazyProxy(result)).toBe(false);
    });

    test('should return existing proxy if already proxied', () => {
      const user = { id: 1, name: 'John' };
      const proxy1 = LazyLoadingProxy.create(user, User, mockProvider);
      const proxy2 = LazyLoadingProxy.create(proxy1, User, mockProvider);

      expect(proxy1).toBe(proxy2);
    });

    test('should create proxies for multiple entities', () => {
      const users = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      
      const proxies = LazyLoadingProxy.createMany(users, User, mockProvider);

      expect(proxies).toHaveLength(2);
      expect(isLazyProxy(proxies[0])).toBe(true);
      expect(isLazyProxy(proxies[1])).toBe(true);
      expect(proxies[0].name).toBe('John');
      expect(proxies[1].name).toBe('Jane');
    });
  });

  describe('Lazy Loading Behavior', () => {
    test('should lazy load one-to-many relationship', async () => {
      const user = { id: 1, name: 'John' };
      const posts = [
        { id: 1, title: 'Post 1', userId: 1 },
        { id: 2, title: 'Post 2', userId: 1 }
      ];

      mockProvider.findWhere.mockResolvedValueOnce(posts as unknown as Post[]);

      const proxy = LazyLoadingProxy.create(user, User, mockProvider) as User;

      // Access posts property - should trigger lazy loading
      const postsPromise = proxy.posts;
      expect(postsPromise).toBeInstanceOf(Promise);

      const loadedPosts = await postsPromise;
      expect(loadedPosts).toHaveLength(2);
      expect(isLazyProxy(loadedPosts[0])).toBe(true);
      expect((loadedPosts[0] as unknown as Post).title).toBe('Post 1');

      // Verify provider was called correctly
      expect(mockProvider.findWhere).toHaveBeenCalledWith(Post, { userId: 1 });
      
      // Second access should return cached result
      const cachedPosts = proxy.posts;
      expect(cachedPosts).toBe(loadedPosts); // Same reference
      expect(mockProvider.findWhere).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should lazy load many-to-one relationship', async () => {
      const post = { id: 1, title: 'Post 1', userId: 1 };
      const user = { id: 1, name: 'John' };

      mockProvider.findById.mockResolvedValueOnce(user as unknown as User);

      const proxy = LazyLoadingProxy.create(post, Post, mockProvider) as Post;

      // Access user property - should trigger lazy loading
      const userPromise = proxy.user;
      expect(userPromise).toBeInstanceOf(Promise);

      const loadedUser = await userPromise;
      expect(isLazyProxy(loadedUser)).toBe(true);
      expect((loadedUser as unknown as User).name).toBe('John');

      // Verify provider was called correctly
      expect(mockProvider.findById).toHaveBeenCalledWith(1, User);
      
      // Second access should return cached result
      const cachedUser = proxy.user;
      expect(cachedUser).toBe(loadedUser);
      expect(mockProvider.findById).toHaveBeenCalledTimes(1);
    });

    test('should handle null foreign keys gracefully', async () => {
      const post = { id: 1, title: 'Post 1', userId: null as unknown as number };
      const proxy = LazyLoadingProxy.create(post, Post, mockProvider) as unknown as Post;

      const userPromise = proxy.user;
      const loadedUser = await userPromise;
      
      expect(loadedUser).toBeNull();
      expect(mockProvider.findById).not.toHaveBeenCalled();
    });

    test('should handle empty one-to-many relationships', async () => {
      const user = { id: 1, name: 'John' };
      mockProvider.findWhere.mockResolvedValueOnce([] as Post[]);

      const proxy = LazyLoadingProxy.create(user, User, mockProvider) as User;

      const postsPromise = proxy.posts;
      const loadedPosts = await postsPromise;
      
      expect(loadedPosts).toEqual([]);
      expect(mockProvider.findWhere).toHaveBeenCalledWith(Post, { userId: 1 });
    });

    test('should handle loading errors gracefully', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const user = { id: 1, name: 'John' };
      mockProvider.findWhere.mockRejectedValueOnce(new Error('Database error'));

      const proxy = LazyLoadingProxy.create(user, User, mockProvider) as User;

      const postsPromise = proxy.posts;
      const loadedPosts = await postsPromise;
      
      expect(loadedPosts).toEqual([]); // Should return empty array for one-to-many
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to lazy load'),
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });

    test('should not lazy load already loaded properties', () => {
      const posts = [{ id: 1, title: 'Post 1', userId: 1 }];
      const user = { id: 1, name: 'John', posts } as unknown as User; // Pre-loaded

      const proxy = LazyLoadingProxy.create(user, User, mockProvider) as User;

      // Should return the pre-loaded posts directly
      const result = proxy.posts;
      expect(result).toBe(posts);
      expect(mockProvider.findWhere).not.toHaveBeenCalled();

      // Check loading state
      expect(LazyLoadingProxy.isRelationshipLoaded(proxy, 'posts')).toBe(true);
    });
  });

  describe('Batch Loading', () => {
    test('should preload relationships for multiple entities', async () => {
      const users = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      const posts = [
        { id: 1, title: 'Post 1', userId: 1 },
        { id: 2, title: 'Post 2', userId: 1 },
        { id: 3, title: 'Post 3', userId: 2 }
      ];

      mockProvider.findWhereIn.mockResolvedValueOnce(posts as unknown as Post[]);

      const proxies = LazyLoadingProxy.createMany(users, User, mockProvider) as User[];
      
      // Preload posts for all users
      await LazyLoadingProxy.preloadRelationships(proxies, User, ['posts'], mockProvider);

      // Verify all posts were loaded in batch
      expect(mockProvider.findWhereIn).toHaveBeenCalledWith(Post, 'userId', [1, 2]);
      
      // Check that each user has their posts
      expect((proxies[0].posts as unknown as Post[])).toHaveLength(2);
      expect((proxies[1].posts as unknown as Post[])).toHaveLength(1);
      expect(((proxies[0].posts as unknown as Post[])[0]).title).toBe('Post 1');
      expect(((proxies[1].posts as unknown as Post[])[0]).title).toBe('Post 3');
    });

    test('should handle mixed proxied and non-proxied entities', async () => {
      const users = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      
      const proxy1 = LazyLoadingProxy.create(users[0], User, mockProvider);
      const mixedEntities = [proxy1, users[1]]; // One proxy, one regular

      mockProvider.findWhereIn.mockResolvedValueOnce([
        { id: 1, title: 'Post 1', userId: 1 }
      ] as unknown as Post[]);

      await LazyLoadingProxy.preloadRelationships(mixedEntities, User, ['posts'], mockProvider);

      // Should handle both types of entities
      expect(mockProvider.findWhereIn).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('should identify lazy proxies correctly', () => {
      const user = { id: 1, name: 'John' };
      const proxy = LazyLoadingProxy.create(user, User, mockProvider);

      expect(isLazyProxy(user)).toBe(false);
      expect(isLazyProxy(proxy)).toBe(true);
    });

    test('should get target from proxy', () => {
      const user = { id: 1, name: 'John' };
      const proxy = LazyLoadingProxy.create(user, User, mockProvider);

      expect(getLazyTarget(user)).toBe(user);
      expect(getLazyTarget(proxy)).toBe(user);
    });

    test('should await lazy load promises', async () => {
      const user = { id: 1, name: 'John' };
      const posts = [{ id: 1, title: 'Post 1', userId: 1 }];

      mockProvider.findWhere.mockResolvedValueOnce(posts as unknown as Post[]);

      const proxy = LazyLoadingProxy.create(user, User, mockProvider) as User;
      const postsPromise = proxy.posts;

      const result = await awaitLazyLoad(postsPromise);
      expect((result as unknown as Post[])).toHaveLength(1);
      expect(((result as unknown as Post[])[0]).title).toBe('Post 1');
    });

    test('should handle non-promise values in awaitLazyLoad', async () => {
      const posts = [{ id: 1, title: 'Post 1' }];
      const result = await awaitLazyLoad(posts);
      expect(result).toBe(posts);
    });

    test('should get loading state for proxy', () => {
      const user = { id: 1, name: 'John' };
      const proxy = LazyLoadingProxy.create(user, User, mockProvider);

      const state = LazyLoadingProxy.getLoadingState(proxy);
      expect(state).toBeDefined();
      expect(state!.posts).toBeDefined();
      expect(state!.posts.isLoaded).toBe(false);
      expect(state!.posts.isLoading).toBe(false);
    });

    test('should check relationship loading status', () => {
      const user = { id: 1, name: 'John' };
      const proxy = LazyLoadingProxy.create(user, User, mockProvider) as User;

      expect(LazyLoadingProxy.isRelationshipLoaded(proxy, 'posts')).toBe(false);
      
      // Manually set posts
      proxy.posts = [] as unknown as Post[];
      expect(LazyLoadingProxy.isRelationshipLoaded(proxy, 'posts')).toBe(true);
    });
  });

  describe('Proxy Behavior', () => {
    test('should preserve enumerable properties', () => {
      const user = { id: 1, name: 'John' };
      const proxy = LazyLoadingProxy.create(user, User, mockProvider);

      const keys = Object.keys(proxy);
      expect(keys).toContain('id');
      expect(keys).toContain('name');
      expect(keys).not.toContain('posts'); // Not yet loaded
    });

    test('should handle property setting correctly', () => {
      const user = { id: 1, name: 'John' };
      const proxy = LazyLoadingProxy.create(user, User, mockProvider) as User;

      const posts = [{ id: 1, title: 'Post 1', userId: 1 } as unknown as Post[]];
      proxy.posts = posts as unknown as Post[];

      expect(proxy.posts).toBe(posts as unknown as Post[]);
      expect(LazyLoadingProxy.isRelationshipLoaded(proxy, 'posts')).toBe(true);
    });

    test('should handle property descriptor correctly', () => {
      const user = { id: 1, name: 'John' };
      const proxy = LazyLoadingProxy.create(user, User, mockProvider);

      const descriptor = Object.getOwnPropertyDescriptor(proxy, 'id');
      expect(descriptor).toBeDefined();
      expect(descriptor!.value).toBe(1);

      const proxyDescriptor = Object.getOwnPropertyDescriptor(proxy, LAZY_LOADING_PROXY);
      expect(proxyDescriptor).toBeDefined();
      expect(proxyDescriptor!.enumerable).toBe(false);
    });
  });
});