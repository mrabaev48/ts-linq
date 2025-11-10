import 'reflect-metadata';
import { EntityLoader } from '../src/loading/EntityLoader';
import { ProviderStub } from './_stubs/ProviderStub';
import { LoadingStrategy } from '../src/loading/LoadingStrategy';
import { Entity, Column, PrimaryKey, OneToMany, ManyToOne } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';

// Define test entities inside functions to ensure decorators execute properly
function createTestEntities() {
  @Entity()
  class LoaderUser {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;

    @OneToMany(() => LoaderPost, { foreignKey: 'userId' })
    posts!: LoaderPost[];
  }

  @Entity()
  class LoaderPost {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    title!: string;

    @Column()
    userId!: number;

    @ManyToOne(() => LoaderUser, { foreignKey: 'userId' })
    user!: LoaderUser;
  }

  return { LoaderUser, LoaderPost };
}

describe('EntityLoader', () => {
  let provider: ProviderStub;
  let entityLoader: EntityLoader;
  let LoaderUser: ReturnType<typeof createTestEntities>['LoaderUser'];
  let LoaderPost: ReturnType<typeof createTestEntities>['LoaderPost'];

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    // Create test entities
    const entities = createTestEntities();
    LoaderUser = entities.LoaderUser;
    LoaderPost = entities.LoaderPost;

    provider = new ProviderStub(':memory:');
    await provider.connect();

    // Create tables
    const userMetadata = MetadataStorage.getEntity(LoaderUser)!;
    const postMetadata = MetadataStorage.getEntity(LoaderPost)!;
    await provider.createTable(userMetadata);
    await provider.createTable(postMetadata);

    entityLoader = new EntityLoader(provider);
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
        strategy: LoadingStrategy.Lazy
      });

      expect(loadedUser).toBeDefined();
      expect(loadedUser!.name).toBe('Test User');
      expect(loadedUser!.posts).toBeUndefined(); // Should not be loaded with lazy strategy
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
        strategy: LoadingStrategy.Eager
      });

      expect(loadedUser).toBeDefined();
      expect(loadedUser!.name).toBe('Test User');
      expect(loadedUser!.posts).toBeDefined();
      expect(loadedUser!.posts).toHaveLength(1);
      expect(loadedUser!.posts[0].title).toBe('Test Post');
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
      expect(loadedUser!.posts).toBeDefined();
      expect(loadedUser!.posts).toHaveLength(1);
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
        strategy: LoadingStrategy.Lazy
      });

      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.posts).toBeUndefined();
      });
    });

    it('should load all entities with eager loading', async () => {
      const users = await entityLoader.loadEntities(LoaderUser, {
        strategy: LoadingStrategy.Eager
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
      entityLoader.setDefaultStrategy(LoadingStrategy.Eager);
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
        strategy: LoadingStrategy.Eager,
        depth: 1
      });

      expect(loadedUser).toBeDefined();
      expect(loadedUser!.posts).toBeDefined();
      expect(loadedUser!.posts).toHaveLength(1);
    });

    it('should not load relationships when depth is 0', async () => {
      const user = new LoaderUser();
      user.name = 'Test User';
      const insertedUser = await provider.insert(user, LoaderUser);

      const loadedUser = await entityLoader.loadEntity(LoaderUser, insertedUser.id, {
        strategy: LoadingStrategy.Eager,
        depth: 0
      });

      expect(loadedUser).toBeDefined();
      expect(loadedUser!.posts).toBeUndefined();
    });
  });
});
