import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';

import { RelationshipLoader } from '../src/loading/RelationshipLoader';

// Identity wrappers — no proxy wrapping, just return entities as-is
const wrapOne = <T extends object>(e: T) => e;
const wrapMany = <T extends object>(arr: T[]) => arr;

function makeProvider(overrides: Partial<any> = {}): any {
  return {
    findById: jest.fn(),
    findWhere: jest.fn(),
    findWhereIn: jest.fn(),
    executeQuery: jest.fn(),
    queryJunction: jest.fn(),
    ...overrides
  };
}

class Author {}
class Post {}
class Tag {}

function registerEntities() {
  MetadataStorage.reset();

  MetadataStorage.addEntity(Tag, 'tags');
  MetadataStorage.addColumn(Tag, { propertyName: 'id', columnName: 'id', type: 'int' } as any);
  MetadataStorage.addColumn(Tag, {
    propertyName: 'name',
    columnName: 'name',
    type: 'varchar'
  } as any);
  MetadataStorage.addPrimaryKey(Tag, 'id');

  MetadataStorage.addEntity(Author, 'authors');
  MetadataStorage.addColumn(Author, { propertyName: 'id', columnName: 'id', type: 'int' } as any);
  MetadataStorage.addColumn(Author, {
    propertyName: 'name',
    columnName: 'name',
    type: 'varchar'
  } as any);
  MetadataStorage.addPrimaryKey(Author, 'id');
  MetadataStorage.addRelationship(Author, {
    propertyName: 'posts',
    type: 'one-to-many',
    targetEntity: Post,
    foreignKey: 'authorId'
  } as any);

  MetadataStorage.addEntity(Post, 'posts');
  MetadataStorage.addColumn(Post, { propertyName: 'id', columnName: 'id', type: 'int' } as any);
  MetadataStorage.addColumn(Post, {
    propertyName: 'authorId',
    columnName: 'authorId',
    type: 'int'
  } as any);
  MetadataStorage.addColumn(Post, {
    propertyName: 'title',
    columnName: 'title',
    type: 'varchar'
  } as any);
  MetadataStorage.addPrimaryKey(Post, 'id');
  MetadataStorage.addRelationship(Post, {
    propertyName: 'author',
    type: 'many-to-one',
    targetEntity: Author,
    foreignKey: 'authorId'
  } as any);
}

describe('RelationshipLoader', () => {
  beforeEach(() => registerEntities());
  afterEach(() => MetadataStorage.reset());

  describe('loadSingle – many-to-one', () => {
    it('fetches related entity by foreign key and wraps it', async () => {
      const author = { id: 10, name: 'Alice' };
      const provider = makeProvider({ findById: jest.fn().mockResolvedValue(author) });
      const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any);

      const post = { id: 1, authorId: 10, title: 'Hello' };
      const relationship = {
        propertyName: 'author',
        type: 'many-to-one',
        targetEntity: Author,
        foreignKey: 'authorId'
      };

      const result = await loader.loadSingle(post, Post as any, relationship as any);

      expect(provider.findById).toHaveBeenCalledWith(10, Author);
      expect(result).toEqual(author);
    });

    it('returns null when the foreign key is null', async () => {
      const provider = makeProvider();
      const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any);

      const post = { id: 1, authorId: null as any, title: 'Orphan' };
      const relationship = {
        propertyName: 'author',
        type: 'many-to-one',
        targetEntity: Author,
        foreignKey: 'authorId'
      };

      const result = await loader.loadSingle(post, Post as any, relationship as any);

      expect(provider.findById).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('loadSingle – one-to-many', () => {
    it('fetches related entities by parent FK and returns array', async () => {
      const posts = [{ id: 1, authorId: 10, title: 'A' }];
      const provider = makeProvider({ findWhere: jest.fn().mockResolvedValue(posts) });
      const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any);

      const author = { id: 10, name: 'Alice' };
      const relationship = {
        propertyName: 'posts',
        type: 'one-to-many',
        targetEntity: Post,
        foreignKey: 'authorId'
      };

      const result = await loader.loadSingle(author, Author as any, relationship as any);

      expect(provider.findWhere).toHaveBeenCalledWith(Post, { authorId: 10 });
      expect(result).toEqual(posts);
    });

    it('returns [] when parent primary key is null', async () => {
      const provider = makeProvider();
      const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any);

      const author = { id: null as any, name: 'Ghost' };
      const relationship = {
        propertyName: 'posts',
        type: 'one-to-many',
        targetEntity: Post,
        foreignKey: 'authorId'
      };

      const result = await loader.loadSingle(author, Author as any, relationship as any);

      expect(provider.findWhere).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('loadBatch – one-to-many', () => {
    it('batch-loads and groups related entities by parent id', async () => {
      const allPosts = [
        { id: 1, authorId: 10, title: 'A' },
        { id: 2, authorId: 20, title: 'B' }
      ];
      const provider = makeProvider({ findWhereIn: jest.fn().mockResolvedValue(allPosts) });
      const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any);

      const authors = [
        { id: 10, name: 'Alice' },
        { id: 20, name: 'Bob' }
      ] as any[];
      const relationship = {
        propertyName: 'posts',
        type: 'one-to-many',
        targetEntity: Post,
        foreignKey: 'authorId'
      };

      await loader.loadBatch(authors, Author as any, relationship as any);

      expect(provider.findWhereIn).toHaveBeenCalledWith(Post, 'authorId', [10, 20]);
      expect(authors[0].posts).toEqual([allPosts[0]]);
      expect(authors[1].posts).toEqual([allPosts[1]]);
    });
  });

  describe('loadSingle – many-to-many', () => {
    it('reads the junction via queryJunction and resolves target entities', async () => {
      const tags = [
        { id: 100, name: 'ts' },
        { id: 200, name: 'sql' }
      ];
      const provider = makeProvider({
        queryJunction: jest.fn().mockResolvedValue([{ tag_id: 100 }, { tag_id: 200 }]),
        findWhereIn: jest.fn().mockResolvedValue(tags)
      });
      const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any);

      const post = { id: 1, title: 'Hello' };
      const relationship = {
        propertyName: 'tags',
        type: 'many-to-many',
        targetEntity: Tag,
        through: { table: 'post_tags', sourceFk: 'post_id', targetFk: 'tag_id' }
      };

      const result = await loader.loadSingle(post, Post as any, relationship as any);

      expect(provider.queryJunction).toHaveBeenCalledWith({
        table: 'post_tags',
        selectColumns: ['tag_id'],
        whereColumn: 'post_id',
        whereValues: [1]
      });
      expect(provider.findWhereIn).toHaveBeenCalledWith(Tag, 'id', [100, 200]);
      expect(result).toEqual(tags);
    });
  });

  describe('loadBatch – many-to-many', () => {
    it('batch-reads the junction via queryJunction and groups by source', async () => {
      const tags = [
        { id: 100, name: 'ts' },
        { id: 200, name: 'sql' }
      ];
      const provider = makeProvider({
        queryJunction: jest.fn().mockResolvedValue([
          { post_id: 1, tag_id: 100 },
          { post_id: 2, tag_id: 200 }
        ]),
        findWhereIn: jest.fn().mockResolvedValue(tags)
      });
      const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any);

      const posts = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' }
      ] as any[];
      const relationship = {
        propertyName: 'tags',
        type: 'many-to-many',
        targetEntity: Tag,
        through: { table: 'post_tags', sourceFk: 'post_id', targetFk: 'tag_id' }
      };

      await loader.loadBatch(posts, Post as any, relationship as any);

      expect(provider.queryJunction).toHaveBeenCalledWith({
        table: 'post_tags',
        selectColumns: ['post_id', 'tag_id'],
        whereColumn: 'post_id',
        whereValues: [1, 2]
      });
      expect(posts[0].tags).toEqual([tags[0]]);
      expect(posts[1].tags).toEqual([tags[1]]);
    });
  });

  describe('loadSingle – unknown target entity string', () => {
    it('returns null without hitting the provider', async () => {
      const provider = makeProvider();
      const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any);

      const relationship = { propertyName: 'ref', type: 'many-to-one', targetEntity: 'SomeString' };
      const result = await loader.loadSingle({}, class Foo {} as any, relationship as any);

      expect(result).toBeNull();
      expect(provider.findById).not.toHaveBeenCalled();
    });
  });
});
