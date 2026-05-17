import { MetadataStorage } from '@ts-linq/metadata';

import type { DatabaseProvider } from '../src/DatabaseProvider';
import { Column } from '../src/decorators/Column';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { ManyToOne, OneToMany } from '../src/decorators/Relationships';
import { EntityLoader } from '../src/loading/EntityLoader';
import { LoadingStrategy } from '../src/loading/LoadingStrategy';

function createTestEntities() {
  @Entity({ name: 'users' })
  class User {
    @PrimaryKey()
    @Column({ type: 'INTEGER' })
    id?: number;

    @Column({ type: 'VARCHAR' })
    name?: string;

    @OneToMany(() => Post, { foreignKey: 'userId' })
    posts?: Post[];
  }

  @Entity({ name: 'posts' })
  class Post {
    @PrimaryKey()
    @Column({ type: 'INTEGER' })
    id?: number;

    @Column({ type: 'VARCHAR' })
    title?: string;

    @Column({ type: 'INTEGER' })
    userId?: number;

    @ManyToOne(() => User, { foreignKey: 'userId' })
    user?: User;
  }

  return { User, Post };
}

describe('EntityLoader', () => {
  let mockProvider: jest.Mocked<Pick<DatabaseProvider, 'findById' | 'findAll' | 'findWhereIn'>>;
  let loader: EntityLoader;
  let mockLogger: { warn: jest.Mock };
  let User: ReturnType<typeof createTestEntities>['User'];
  let Post: ReturnType<typeof createTestEntities>['Post'];

  beforeEach(() => {
    MetadataStorage.getInstance().clear();

    const entities = createTestEntities();
    User = entities.User;
    Post = entities.Post;

    mockProvider = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findWhereIn: jest.fn()
    };

    mockLogger = { warn: jest.fn() };
    loader = new EntityLoader(mockProvider as any, mockLogger);
  });

  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('constructor', () => {
    it('should create loader with provider', () => {
      expect(loader).toBeInstanceOf(EntityLoader);
    });

    it('should create loader with provider and logger', () => {
      const loaderWithLogger = new EntityLoader(mockProvider as any, mockLogger);
      expect(loaderWithLogger).toBeInstanceOf(EntityLoader);
    });

    it('should create loader without logger', () => {
      const loaderNoLogger = new EntityLoader(mockProvider as any);
      expect(loaderNoLogger).toBeInstanceOf(EntityLoader);
    });
  });

  describe('setDefaultStrategy()', () => {
    it('should set default strategy to Lazy', () => {
      loader.setDefaultStrategy(LoadingStrategy.Lazy);
      expect(() => loader.setDefaultStrategy(LoadingStrategy.Lazy)).not.toThrow();
    });

    it('should set default strategy to Eager', () => {
      loader.setDefaultStrategy(LoadingStrategy.Eager);
      expect(() => loader.setDefaultStrategy(LoadingStrategy.Eager)).not.toThrow();
    });

    it('should allow changing strategy', () => {
      loader.setDefaultStrategy(LoadingStrategy.Lazy);
      loader.setDefaultStrategy(LoadingStrategy.Eager);
      loader.setDefaultStrategy(LoadingStrategy.Lazy);
      expect(() => loader.setDefaultStrategy(LoadingStrategy.Lazy)).not.toThrow();
    });
  });

  describe('setInChunkSize()', () => {
    it('should set valid chunk size', () => {
      loader.setInChunkSize(500);
      expect(() => loader.setInChunkSize(500)).not.toThrow();
    });

    it('should ignore invalid chunk size (zero)', () => {
      expect(() => loader.setInChunkSize(0)).not.toThrow();
    });

    it('should ignore invalid chunk size (negative)', () => {
      expect(() => loader.setInChunkSize(-100)).not.toThrow();
    });

    it('should ignore non-number values', () => {
      expect(() => loader.setInChunkSize(undefined)).not.toThrow();
    });

    it('should accept large chunk sizes', () => {
      expect(() => loader.setInChunkSize(10000)).not.toThrow();
    });
  });

  describe('loadEntity()', () => {
    it('should load entity by id', async () => {
      const user = { id: 1, name: 'John' };
      mockProvider.findById.mockResolvedValue(user);

      const result = await loader.loadEntity(User, 1);

      expect(result).toEqual(user);
      expect(mockProvider.findById).toHaveBeenCalledWith(1, User);
    });

    it('should return null when entity not found', async () => {
      mockProvider.findById.mockResolvedValue(null);

      const result = await loader.loadEntity(User, 999);

      expect(result).toBeNull();
    });

    it('should accept lazy loading strategy option', async () => {
      const user = { id: 1, name: 'John' };
      mockProvider.findById.mockResolvedValue(user);

      const result = await loader.loadEntity(User, 1, {
        strategy: LoadingStrategy.Lazy
      });

      expect(result).toEqual(user);
    });

    it('should accept eager loading strategy option', async () => {
      const user = { id: 1, name: 'John' };
      mockProvider.findById.mockResolvedValue(user);

      const result = await loader.loadEntity(User, 1, {
        strategy: LoadingStrategy.Eager
      });

      expect(result).toEqual(user);
    });

    it('should accept includes option', async () => {
      const user = { id: 1, name: 'John' };
      mockProvider.findById.mockResolvedValue(user);

      const result = await loader.loadEntity(User, 1, {
        includes: ['posts']
      });

      expect(result).toEqual(user);
    });

    it('should accept depth option', async () => {
      const user = { id: 1, name: 'John' };
      mockProvider.findById.mockResolvedValue(user);

      const result = await loader.loadEntity(User, 1, {
        depth: 2
      });

      expect(result).toEqual(user);
    });

    it('should handle combined options', async () => {
      const user = { id: 1, name: 'John' };
      mockProvider.findById.mockResolvedValue(user);

      const result = await loader.loadEntity(User, 1, {
        strategy: LoadingStrategy.Eager,
        includes: ['posts'],
        depth: 1
      });

      expect(result).toBeDefined();
    });
  });

  describe('loadEntities()', () => {
    it('should load all entities', async () => {
      const users = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      mockProvider.findAll.mockResolvedValue(users);

      const result = await loader.loadEntities(User);

      expect(result).toEqual(users);
      expect(mockProvider.findAll).toHaveBeenCalledWith(User);
    });

    it('should return empty array when no entities found', async () => {
      mockProvider.findAll.mockResolvedValue([]);

      const result = await loader.loadEntities(User);

      expect(result).toEqual([]);
    });

    it('should accept lazy loading strategy', async () => {
      const users = [{ id: 1, name: 'John' }];
      mockProvider.findAll.mockResolvedValue(users);

      const result = await loader.loadEntities(User, {
        strategy: LoadingStrategy.Lazy
      });

      expect(result).toEqual(users);
    });

    it('should accept eager loading strategy', async () => {
      const users = [{ id: 1, name: 'John' }];
      mockProvider.findAll.mockResolvedValue(users);
      mockProvider.findWhereIn.mockResolvedValue([]);

      const result = await loader.loadEntities(User, {
        strategy: LoadingStrategy.Eager
      });

      expect(result).toBeDefined();
    });

    it('should accept includes option', async () => {
      const users = [{ id: 1, name: 'John' }];
      mockProvider.findAll.mockResolvedValue(users);
      mockProvider.findWhereIn.mockResolvedValue([]);

      const result = await loader.loadEntities(User, {
        includes: ['posts']
      });

      expect(result).toBeDefined();
    });

    it('should accept depth option', async () => {
      const users = [{ id: 1, name: 'John' }];
      mockProvider.findAll.mockResolvedValue(users);

      const result = await loader.loadEntities(User, {
        depth: 2
      });

      expect(result).toBeDefined();
    });

    it('should handle combined options', async () => {
      const users = [{ id: 1, name: 'John' }];
      mockProvider.findAll.mockResolvedValue(users);
      mockProvider.findWhereIn.mockResolvedValue([]);

      const result = await loader.loadEntities(User, {
        strategy: LoadingStrategy.Eager,
        includes: ['posts'],
        depth: 1
      });

      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should propagate errors from findById', async () => {
      mockProvider.findById.mockRejectedValue(new Error('Database error'));

      await expect(loader.loadEntity(User, 1)).rejects.toThrow('Database error');
    });

    it('should propagate errors from findAll', async () => {
      mockProvider.findAll.mockRejectedValue(new Error('Database error'));

      await expect(loader.loadEntities(User)).rejects.toThrow('Database error');
    });
  });
});
