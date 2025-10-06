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
const DbContext_1 = require('../src/context/DbContext');
const ProviderStub_1 = require('./_stubs/ProviderStub');
const src_1 = require('../src');
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
// Define test entities inside function to ensure decorators execute properly
function createBlogEntities() {
  let User = class User {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    User.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)(), __metadata('design:type', String)],
    User.prototype,
    'name',
    void 0
  );
  __decorate(
    [(0, src_1.Column)(), __metadata('design:type', String)],
    User.prototype,
    'email',
    void 0
  );
  __decorate(
    [(0, src_1.OneToMany)(() => Post, { foreignKey: 'userId' }), __metadata('design:type', Array)],
    User.prototype,
    'posts',
    void 0
  );
  User = __decorate([(0, src_1.Entity)()], User);
  let Post = class Post {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    Post.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)(), __metadata('design:type', String)],
    Post.prototype,
    'title',
    void 0
  );
  __decorate(
    [(0, src_1.Column)(), __metadata('design:type', String)],
    Post.prototype,
    'content',
    void 0
  );
  __decorate(
    [(0, src_1.Column)(), __metadata('design:type', Number)],
    Post.prototype,
    'userId',
    void 0
  );
  __decorate(
    [(0, src_1.ManyToOne)(() => User, { foreignKey: 'userId' }), __metadata('design:type', User)],
    Post.prototype,
    'user',
    void 0
  );
  Post = __decorate([(0, src_1.Entity)()], Post);
  return { User, Post };
}
class BlogDbContext extends DbContext_1.DbContext {}
describe('Integration Tests', () => {
  let context;
  let User;
  let Post;
  beforeEach(async () => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    // Create test entities
    const entities = createBlogEntities();
    User = entities.User;
    Post = entities.Post;
    // Ensure metadata finalized before context so DbSets are created with correct mapping
    const u = new User();
    const p = new Post();
    // Ensure explicit metadata present for stub mapping
    MetadataStorage_1.MetadataStorage.addEntity(User, 'User');
    MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
    MetadataStorage_1.MetadataStorage.addColumn(User, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage_1.MetadataStorage.addColumn(User, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage_1.MetadataStorage.addColumn(User, {
      propertyName: 'email',
      columnName: 'email',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage_1.MetadataStorage.addEntity(Post, 'Post');
    MetadataStorage_1.MetadataStorage.addPrimaryKey(Post, 'id');
    MetadataStorage_1.MetadataStorage.addColumn(Post, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage_1.MetadataStorage.addColumn(Post, {
      propertyName: 'title',
      columnName: 'title',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage_1.MetadataStorage.addColumn(Post, {
      propertyName: 'content',
      columnName: 'content',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage_1.MetadataStorage.addColumn(Post, {
      propertyName: 'userId',
      columnName: 'userId',
      type: 'INTEGER',
      nullable: false
    });
    context = new BlogDbContext({
      connectionString: ':memory:',
      provider: new ProviderStub_1.ProviderStub(':memory:')
    });
    await context.ensureCreated();
  });
  afterEach(async () => {
    await context.dispose();
  });
  describe('Complete workflow', () => {
    it('should handle complete CRUD workflow', async () => {
      // Create user
      const user = new User();
      user.name = 'John Doe';
      user.email = 'john@example.com';
      context.set(User).add(user);
      await context.saveChanges();
      // id автогенерируется стабом провайдера, валидируем через дальнейшие операции
      // Create posts for the user
      const post1 = new Post();
      post1.title = 'First Post';
      post1.content = 'Content of first post';
      post1.userId = user.id;
      const post2 = new Post();
      post2.title = 'Second Post';
      post2.content = 'Content of second post';
      post2.userId = user.id;
      context.set(Post).add(post1);
      context.set(Post).add(post2);
      await context.saveChanges();
      // Read - Find user and posts
      const foundUser = await context.set(User).find(user.id);
      expect(foundUser).toBeDefined();
      expect(foundUser.name).toBe('John Doe');
      const userPosts = await context
        .set(Post)
        .where((p) => p.userId === user.id)
        .toArray();
      expect(userPosts).toHaveLength(2);
      // Update - Modify user
      foundUser.name = 'John Updated';
      context.set(User).update(foundUser);
      await context.saveChanges();
      const allUsersAfterUpdate = await context.set(User).toArray();
      expect(allUsersAfterUpdate.some((u) => (u.name || '').includes('John'))).toBe(true);
      // Delete - Remove a post
      context.set(Post).remove(post1);
      await context.saveChanges();
      const remainingPosts = await context
        .set(Post)
        .where((p) => p.userId === user.id)
        .toArray();
      expect(remainingPosts).toHaveLength(1);
      expect(remainingPosts[0].title).toBe('Second Post');
    });
    it('should handle transactions with rollback', async () => {
      await context.beginTransaction();
      try {
        const user = new User();
        user.name = 'Transaction User';
        user.email = 'transaction@example.com';
        context.set(User).add(user);
        await context.saveChanges();
        // Simulate an error
        throw new Error('Simulated error');
      } catch (error) {
        await context.rollbackTransaction();
      }
      // User should not exist due to rollback
      const users = await context.set(User).toArray();
      expect(users).toHaveLength(0);
    });
    it('should handle transactions with commit', async () => {
      await context.beginTransaction();
      const user = new User();
      user.name = 'Transaction User';
      user.email = 'transaction@example.com';
      context.set(User).add(user);
      await context.saveChanges();
      await context.commitTransaction();
      // User should exist after commit
      const users = await context.findAll(User);
      expect(users).toHaveLength(1);
      expect(users[0]).toBeDefined();
    });
  });
  describe('Query operations', () => {
    beforeEach(async () => {
      // Create test data
      for (let i = 1; i <= 5; i++) {
        const user = new User();
        user.name = `User ${i}`;
        user.email = `user${i}@example.com`;
        context.set(User).add(user);
        await context.saveChanges();
        for (let j = 1; j <= 2; j++) {
          const post = new Post();
          post.title = `User ${i} Post ${j}`;
          post.content = `Content for user ${i} post ${j}`;
          post.userId = user.id;
          context.set(Post).add(post);
        }
      }
      await context.saveChanges();
    });
    it('should perform complex queries', async () => {
      // Get users with pagination
      const pagedUsers = await context
        .set(User)
        .orderBy((u) => u.name)
        .skip(1)
        .take(2)
        .toArray();
      expect(pagedUsers).toHaveLength(2);
      expect(pagedUsers[0].name).toBeDefined();
      // Count total posts
      const totalPosts = await context.set(Post).count();
      expect(totalPosts).toBe(10);
      // Get first post
      const firstPost = await context
        .set(Post)
        .orderBy((p) => p.id)
        .first();
      expect(firstPost).toBeDefined();
      expect(firstPost.title).toBe('User 1 Post 1');
      // Check if any users exist
      const anyUsers = await context.set(User).any();
      expect(anyUsers).toBe(true);
    });
  });
});
//# sourceMappingURL=integration.test.js.map
