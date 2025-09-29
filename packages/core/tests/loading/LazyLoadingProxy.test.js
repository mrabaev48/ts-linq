"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const LazyLoadingProxy_1 = require("../../src/loading/LazyLoadingProxy");
const MetadataStorage_1 = require("../../src/metadata/MetadataStorage");
// Test entities
class User {
}
class Post {
}
describe('LazyLoadingProxy', () => {
    let mockProvider;
    beforeEach(() => {
        // Clear metadata before each test
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        // Re-register entities manually
        MetadataStorage_1.MetadataStorage.addEntity(User, 'users');
        const userIdCol = {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
        };
        const userNameCol = {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            nullable: false
        };
        MetadataStorage_1.MetadataStorage.addColumn(User, userIdCol);
        MetadataStorage_1.MetadataStorage.addColumn(User, userNameCol);
        MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
        const userPostsRel = {
            type: 'one-to-many',
            propertyName: 'posts',
            targetEntity: () => Post,
            foreignKey: 'userId',
            inverseSide: 'user'
        };
        MetadataStorage_1.MetadataStorage.addRelationship(User, userPostsRel);
        MetadataStorage_1.MetadataStorage.addEntity(Post, 'posts');
        const postIdCol = {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
        };
        const postTitleCol = {
            propertyName: 'title',
            columnName: 'title',
            type: 'TEXT',
            nullable: false
        };
        const postUserIdCol = {
            propertyName: 'userId',
            columnName: 'user_id',
            type: 'INTEGER',
            nullable: true
        };
        MetadataStorage_1.MetadataStorage.addColumn(Post, postIdCol);
        MetadataStorage_1.MetadataStorage.addColumn(Post, postTitleCol);
        MetadataStorage_1.MetadataStorage.addColumn(Post, postUserIdCol);
        MetadataStorage_1.MetadataStorage.addPrimaryKey(Post, 'id');
        const postUserRel = {
            type: 'many-to-one',
            propertyName: 'user',
            targetEntity: () => User,
            foreignKey: 'userId'
        };
        MetadataStorage_1.MetadataStorage.addRelationship(Post, postUserRel);
        mockProvider = {
            findById: jest.fn(),
            findWhere: jest.fn(),
            findWhereIn: jest.fn(),
            findAll: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
            createTable: jest.fn(),
            getDialect: jest.fn(),
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
        };
    });
    afterEach(async () => {
        // Clear all mocks to prevent resource leaks
        jest.clearAllMocks();
        jest.clearAllTimers();
        // Wait for any pending promises to resolve
        await new Promise((resolve) => setImmediate(resolve));
    });
    afterAll(() => {
        // Final cleanup
        MetadataStorage_1.MetadataStorage.getInstance().clear();
    });
    describe('Proxy Creation', () => {
        test('should create lazy proxy for entity with relationships', () => {
            const user = { id: 1, name: 'John' };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            expect((0, LazyLoadingProxy_1.isLazyProxy)(proxy)).toBe(true);
            expect(proxy.id).toBe(1);
            expect(proxy.name).toBe('John');
        });
        test('should not create proxy for entity without relationships', () => {
            // Create entity without relationships
            class SimpleEntity {
            }
            MetadataStorage_1.MetadataStorage.addEntity(SimpleEntity, 'simple');
            const idCol = {
                propertyName: 'id',
                columnName: 'id',
                type: 'INTEGER',
                nullable: false
            };
            MetadataStorage_1.MetadataStorage.addColumn(SimpleEntity, idCol);
            MetadataStorage_1.MetadataStorage.addPrimaryKey(SimpleEntity, 'id');
            const entity = { id: 1 };
            const result = LazyLoadingProxy_1.LazyLoadingProxy.create(entity, SimpleEntity, mockProvider);
            expect(result).toBe(entity); // Should return original entity
            expect((0, LazyLoadingProxy_1.isLazyProxy)(result)).toBe(false);
        });
        test('should return existing proxy if already proxied', () => {
            const user = { id: 1, name: 'John' };
            const proxy1 = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            const proxy2 = LazyLoadingProxy_1.LazyLoadingProxy.create(proxy1, User, mockProvider);
            expect(proxy1).toBe(proxy2);
        });
        test('should create proxies for multiple entities', () => {
            const users = [
                { id: 1, name: 'John' },
                { id: 2, name: 'Jane' }
            ];
            const proxies = LazyLoadingProxy_1.LazyLoadingProxy.createMany(users, User, mockProvider);
            expect(proxies).toHaveLength(2);
            expect((0, LazyLoadingProxy_1.isLazyProxy)(proxies[0])).toBe(true);
            expect((0, LazyLoadingProxy_1.isLazyProxy)(proxies[1])).toBe(true);
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
            mockProvider.findWhere.mockResolvedValueOnce(posts);
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            // Access posts property - should trigger lazy loading
            const postsPromise = proxy.posts;
            expect(postsPromise).toBeInstanceOf(Promise);
            // eslint-disable-next-line @typescript-eslint/await-thenable
            const loadedPosts = await postsPromise;
            expect(loadedPosts).toHaveLength(2);
            expect((0, LazyLoadingProxy_1.isLazyProxy)(loadedPosts[0])).toBe(true);
            expect(loadedPosts[0].title).toBe('Post 1');
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
            mockProvider.findById.mockResolvedValueOnce(user);
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(post, Post, mockProvider);
            // Access user property - should trigger lazy loading
            const userPromise = proxy.user;
            expect(userPromise).toBeInstanceOf(Promise);
            // eslint-disable-next-line @typescript-eslint/await-thenable
            const loadedUser = await userPromise;
            expect((0, LazyLoadingProxy_1.isLazyProxy)(loadedUser)).toBe(true);
            expect(loadedUser.name).toBe('John');
            // Verify provider was called correctly
            expect(mockProvider.findById).toHaveBeenCalledWith(1, User);
            // Second access should return cached result
            const cachedUser = proxy.user;
            expect(cachedUser).toBe(loadedUser);
            expect(mockProvider.findById).toHaveBeenCalledTimes(1);
        });
        test('should handle null foreign keys gracefully', async () => {
            const post = { id: 1, title: 'Post 1', userId: null };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(post, Post, mockProvider);
            const userPromise = proxy.user;
            // eslint-disable-next-line @typescript-eslint/await-thenable
            const loadedUser = await userPromise;
            expect(loadedUser).toBeNull();
            expect(mockProvider.findById).not.toHaveBeenCalled();
        });
        test('should handle empty one-to-many relationships', async () => {
            const user = { id: 1, name: 'John' };
            mockProvider.findWhere.mockResolvedValueOnce([]);
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            const postsPromise = proxy.posts;
            // eslint-disable-next-line @typescript-eslint/await-thenable
            const loadedPosts = await postsPromise;
            expect(loadedPosts).toEqual([]);
            expect(mockProvider.findWhere).toHaveBeenCalledWith(Post, { userId: 1 });
        });
        test('should handle loading errors gracefully', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
            const user = { id: 1, name: 'John' };
            mockProvider.findWhere.mockRejectedValueOnce(new Error('Database error'));
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            const postsPromise = proxy.posts;
            const loadedPosts = await postsPromise;
            expect(loadedPosts).toEqual([]); // Should return empty array for one-to-many
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to lazy load'), expect.any(Error));
            warnSpy.mockRestore();
        });
        test('should not lazy load already loaded properties', () => {
            const posts = [{ id: 1, title: 'Post 1', userId: 1 }];
            const user = { id: 1, name: 'John', posts }; // Pre-loaded
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            // Should return the pre-loaded posts directly
            const result = proxy.posts;
            expect(result).toBe(posts);
            expect(mockProvider.findWhere).not.toHaveBeenCalled();
            // Check loading state
            expect(LazyLoadingProxy_1.LazyLoadingProxy.isRelationshipLoaded(proxy, 'posts')).toBe(true);
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
            mockProvider.findWhereIn.mockResolvedValueOnce(posts);
            const proxies = LazyLoadingProxy_1.LazyLoadingProxy.createMany(users, User, mockProvider);
            // Preload posts for all users
            await LazyLoadingProxy_1.LazyLoadingProxy.preloadRelationships(proxies, User, ['posts'], mockProvider);
            // Verify all posts were loaded in batch
            expect(mockProvider.findWhereIn).toHaveBeenCalledWith(Post, 'userId', [1, 2]);
            // Check that each user has their posts
            expect(proxies[0].posts).toHaveLength(2);
            expect(proxies[1].posts).toHaveLength(1);
            expect(proxies[0].posts[0].title).toBe('Post 1');
            expect(proxies[1].posts[0].title).toBe('Post 3');
        });
        test('should handle mixed proxied and non-proxied entities', async () => {
            const users = [
                { id: 1, name: 'John' },
                { id: 2, name: 'Jane' }
            ];
            const proxy1 = LazyLoadingProxy_1.LazyLoadingProxy.create(users[0], User, mockProvider);
            const mixedEntities = [proxy1, users[1]]; // One proxy, one regular
            mockProvider.findWhereIn.mockResolvedValueOnce([
                { id: 1, title: 'Post 1', userId: 1 }
            ]);
            await LazyLoadingProxy_1.LazyLoadingProxy.preloadRelationships(mixedEntities, User, ['posts'], mockProvider);
            // Should handle both types of entities
            expect(mockProvider.findWhereIn).toHaveBeenCalled();
        });
    });
    describe('Utility Functions', () => {
        test('should identify lazy proxies correctly', () => {
            const user = { id: 1, name: 'John' };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            expect((0, LazyLoadingProxy_1.isLazyProxy)(user)).toBe(false);
            expect((0, LazyLoadingProxy_1.isLazyProxy)(proxy)).toBe(true);
        });
        test('should get target from proxy', () => {
            const user = { id: 1, name: 'John' };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            expect((0, LazyLoadingProxy_1.getLazyTarget)(user)).toBe(user);
            expect((0, LazyLoadingProxy_1.getLazyTarget)(proxy)).toBe(user);
        });
        test('should await lazy load promises', async () => {
            const user = { id: 1, name: 'John' };
            const posts = [{ id: 1, title: 'Post 1', userId: 1 }];
            mockProvider.findWhere.mockResolvedValueOnce(posts);
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            const postsPromise = proxy.posts;
            const result = await (0, LazyLoadingProxy_1.awaitLazyLoad)(postsPromise);
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Post 1');
        });
        test('should handle non-promise values in awaitLazyLoad', async () => {
            const posts = [{ id: 1, title: 'Post 1' }];
            const result = await (0, LazyLoadingProxy_1.awaitLazyLoad)(posts);
            expect(result).toBe(posts);
        });
        test('should get loading state for proxy', () => {
            const user = { id: 1, name: 'John' };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            const state = LazyLoadingProxy_1.LazyLoadingProxy.getLoadingState(proxy);
            expect(state).toBeDefined();
            expect(state.posts).toBeDefined();
            expect(state.posts.isLoaded).toBe(false);
            expect(state.posts.isLoading).toBe(false);
        });
        test('should check relationship loading status', () => {
            const user = { id: 1, name: 'John' };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            expect(LazyLoadingProxy_1.LazyLoadingProxy.isRelationshipLoaded(proxy, 'posts')).toBe(false);
            // Manually set posts
            proxy.posts = [];
            expect(LazyLoadingProxy_1.LazyLoadingProxy.isRelationshipLoaded(proxy, 'posts')).toBe(true);
        });
    });
    describe('Proxy Behavior', () => {
        test('should preserve enumerable properties', () => {
            const user = { id: 1, name: 'John' };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            const keys = Object.keys(proxy);
            expect(keys).toContain('id');
            expect(keys).toContain('name');
            expect(keys).not.toContain('posts'); // Not yet loaded
        });
        test('should handle property setting correctly', () => {
            const user = { id: 1, name: 'John' };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            const posts = [{ id: 1, title: 'Post 1', userId: 1 }];
            proxy.posts = posts;
            expect(proxy.posts).toBe(posts);
            expect(LazyLoadingProxy_1.LazyLoadingProxy.isRelationshipLoaded(proxy, 'posts')).toBe(true);
        });
        test('should handle property descriptor correctly', () => {
            const user = { id: 1, name: 'John' };
            const proxy = LazyLoadingProxy_1.LazyLoadingProxy.create(user, User, mockProvider);
            const descriptor = Object.getOwnPropertyDescriptor(proxy, 'id');
            expect(descriptor).toBeDefined();
            expect(descriptor.value).toBe(1);
            const proxyDescriptor = Object.getOwnPropertyDescriptor(proxy, LazyLoadingProxy_1.LAZY_LOADING_PROXY);
            expect(proxyDescriptor).toBeDefined();
            expect(proxyDescriptor.enumerable).toBe(false);
        });
    });
});
//# sourceMappingURL=LazyLoadingProxy.test.js.map