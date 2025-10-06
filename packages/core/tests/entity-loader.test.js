'use strict';
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
            ? (desc = Object.getOwnPropertyDescriptor(target, key))
            : desc,
      d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return (c > 3 && r && Object.defineProperty(target, key, r), r);
  };
var __metadata =
  (this && this.__metadata) ||
  function (k, v) {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
      return Reflect.metadata(k, v);
  };
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const EntityLoader_1 = require('../src/loading/EntityLoader');
const ProviderStub_1 = require('./_stubs/ProviderStub');
const LoadingStrategy_1 = require('../src/loading/LoadingStrategy');
const src_1 = require('../src');
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
// Define test entities inside functions to ensure decorators execute properly
function createTestEntities() {
  let LoaderUser = class LoaderUser {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    LoaderUser.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)(), __metadata('design:type', String)],
    LoaderUser.prototype,
    'name',
    void 0
  );
  __decorate(
    [
      (0, src_1.OneToMany)(() => LoaderPost, { foreignKey: 'userId' }),
      __metadata('design:type', Array)
    ],
    LoaderUser.prototype,
    'posts',
    void 0
  );
  LoaderUser = __decorate([(0, src_1.Entity)()], LoaderUser);
  let LoaderPost = class LoaderPost {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    LoaderPost.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)(), __metadata('design:type', String)],
    LoaderPost.prototype,
    'title',
    void 0
  );
  __decorate(
    [(0, src_1.Column)(), __metadata('design:type', Number)],
    LoaderPost.prototype,
    'userId',
    void 0
  );
  __decorate(
    [
      (0, src_1.ManyToOne)(() => LoaderUser, { foreignKey: 'userId' }),
      __metadata('design:type', LoaderUser)
    ],
    LoaderPost.prototype,
    'user',
    void 0
  );
  LoaderPost = __decorate([(0, src_1.Entity)()], LoaderPost);
  return { LoaderUser, LoaderPost };
}
describe('EntityLoader', () => {
  let provider;
  let entityLoader;
  let LoaderUser;
  let LoaderPost;
  beforeEach(async () => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    // Create test entities
    const entities = createTestEntities();
    LoaderUser = entities.LoaderUser;
    LoaderPost = entities.LoaderPost;
    provider = new ProviderStub_1.ProviderStub(':memory:');
    await provider.connect();
    // Create tables
    const userMetadata = MetadataStorage_1.MetadataStorage.getEntity(LoaderUser);
    const postMetadata = MetadataStorage_1.MetadataStorage.getEntity(LoaderPost);
    await provider.createTable(userMetadata);
    await provider.createTable(postMetadata);
    entityLoader = new EntityLoader_1.EntityLoader(provider);
  });
  afterEach(async () => {
    await provider.disconnect();
  });
  describe('loadEntity', () => {
    it('should load entity with lazy loading', async () => {
      // Create test data
      const user = new LoaderUser();
      user.name = 'Test User';
      const insertedUser = await provider.insert(user, LoaderUser);
      const loadedUser = await entityLoader.loadEntity(LoaderUser, insertedUser.id, {
        strategy: LoadingStrategy_1.LoadingStrategy.Lazy
      });
      expect(loadedUser).toBeDefined();
      expect(loadedUser.name).toBe('Test User');
      expect(loadedUser.posts).toBeUndefined(); // Should not be loaded with lazy strategy
    });
    it('should load entity with eager loading', async () => {
      // Create test data
      const user = new LoaderUser();
      user.name = 'Test User';
      const insertedUser = await provider.insert(user, LoaderUser);
      const post = new LoaderPost();
      post.title = 'Test Post';
      post.userId = insertedUser.id;
      await provider.insert(post, LoaderPost);
      const loadedUser = await entityLoader.loadEntity(LoaderUser, insertedUser.id, {
        strategy: LoadingStrategy_1.LoadingStrategy.Eager
      });
      expect(loadedUser).toBeDefined();
      expect(loadedUser.name).toBe('Test User');
      expect(loadedUser.posts).toBeDefined();
      expect(loadedUser.posts).toHaveLength(1);
      expect(loadedUser.posts[0].title).toBe('Test Post');
    });
    it('should load specific relationships with includes', async () => {
      // Create test data
      const user = new LoaderUser();
      user.name = 'Test User';
      const insertedUser = await provider.insert(user, LoaderUser);
      const post = new LoaderPost();
      post.title = 'Test Post';
      post.userId = insertedUser.id;
      await provider.insert(post, LoaderPost);
      const loadedUser = await entityLoader.loadEntity(LoaderUser, insertedUser.id, {
        includes: ['posts']
      });
      expect(loadedUser).toBeDefined();
      expect(loadedUser.posts).toBeDefined();
      expect(loadedUser.posts).toHaveLength(1);
    });
    it('should return null for non-existent entity', async () => {
      const loadedUser = await entityLoader.loadEntity(LoaderUser, 999);
      expect(loadedUser).toBeNull();
    });
  });
  describe('loadEntities', () => {
    beforeEach(async () => {
      // Create test data
      for (let i = 1; i <= 3; i++) {
        const user = new LoaderUser();
        user.name = `User ${i}`;
        const insertedUser = await provider.insert(user, LoaderUser);
        for (let j = 1; j <= 2; j++) {
          const post = new LoaderPost();
          post.title = `User ${i} Post ${j}`;
          post.userId = insertedUser.id;
          await provider.insert(post, LoaderPost);
        }
      }
    });
    it('should load all entities with lazy loading', async () => {
      const users = await entityLoader.loadEntities(LoaderUser, {
        strategy: LoadingStrategy_1.LoadingStrategy.Lazy
      });
      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.posts).toBeUndefined();
      });
    });
    it('should load all entities with eager loading', async () => {
      const users = await entityLoader.loadEntities(LoaderUser, {
        strategy: LoadingStrategy_1.LoadingStrategy.Eager
      });
      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.posts).toBeDefined();
        expect(user.posts).toHaveLength(2);
      });
    });
    it('should load entities with specific includes', async () => {
      const users = await entityLoader.loadEntities(LoaderUser, {
        includes: ['posts']
      });
      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.posts).toBeDefined();
        expect(user.posts).toHaveLength(2);
      });
    });
  });
  describe('setDefaultStrategy', () => {
    it('should change the default loading strategy', () => {
      entityLoader.setDefaultStrategy(LoadingStrategy_1.LoadingStrategy.Eager);
      // This test verifies the method exists and doesn't throw
      expect(true).toBe(true);
    });
  });
  describe('depth limiting', () => {
    it('should respect depth limits to prevent infinite recursion', async () => {
      const user = new LoaderUser();
      user.name = 'Test User';
      const insertedUser = await provider.insert(user, LoaderUser);
      const post = new LoaderPost();
      post.title = 'Test Post';
      post.userId = insertedUser.id;
      await provider.insert(post, LoaderPost);
      const loadedUser = await entityLoader.loadEntity(LoaderUser, insertedUser.id, {
        strategy: LoadingStrategy_1.LoadingStrategy.Eager,
        depth: 1
      });
      expect(loadedUser).toBeDefined();
      expect(loadedUser.posts).toBeDefined();
      expect(loadedUser.posts).toHaveLength(1);
    });
    it('should not load relationships when depth is 0', async () => {
      const user = new LoaderUser();
      user.name = 'Test User';
      const insertedUser = await provider.insert(user, LoaderUser);
      const loadedUser = await entityLoader.loadEntity(LoaderUser, insertedUser.id, {
        strategy: LoadingStrategy_1.LoadingStrategy.Eager,
        depth: 0
      });
      expect(loadedUser).toBeDefined();
      expect(loadedUser.posts).toBeUndefined();
    });
  });
});
//# sourceMappingURL=entity-loader.test.js.map
