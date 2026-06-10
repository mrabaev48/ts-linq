import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';

import { EntityLoader } from '../src/loading/EntityLoader';
import { LoadingStrategy } from '../src/loading/LoadingStrategy';

// Identity provider doubles — assert SQL fan-out shape via jest.fn.
function makeProvider(overrides: Partial<Record<string, unknown>> = {}): any {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    findWhere: jest.fn(),
    findWhereIn: jest.fn(),
    queryJunction: jest.fn(),
    loggerRef: undefined,
    providerLabel: 'test',
    ...overrides
  };
}

class Post {}
class Tag {}

function registerEntities() {
  MetadataStorage.reset();

  MetadataStorage.addEntity(Tag, 'tags');
  MetadataStorage.addColumn(Tag, { propertyName: 'id', columnName: 'id', type: 'int' } as any);
  MetadataStorage.addPrimaryKey(Tag, 'id');

  MetadataStorage.addEntity(Post, 'posts');
  MetadataStorage.addColumn(Post, { propertyName: 'id', columnName: 'id', type: 'int' } as any);
  MetadataStorage.addPrimaryKey(Post, 'id');
  MetadataStorage.addRelationship(Post, {
    propertyName: 'tags',
    type: 'many-to-many',
    targetEntity: Tag,
    through: { table: 'post_tags', sourceFk: 'postId', targetFk: 'tagId' }
  } as any);
}

describe('EntityLoader – many-to-many eager loading (folded-in capability)', () => {
  beforeEach(() => registerEntities());
  afterEach(() => MetadataStorage.reset());

  it('eager-loads a many-to-many collection through the junction (single entity)', async () => {
    const post = { id: 1 };
    const tags = [
      { id: 100, name: 'ts' },
      { id: 200, name: 'sql' }
    ];
    const provider = makeProvider({
      findById: jest.fn().mockResolvedValue(post),
      queryJunction: jest.fn().mockResolvedValue([{ tagId: 100 }, { tagId: 200 }]),
      findWhereIn: jest.fn().mockResolvedValue(tags)
    });
    const loader = new EntityLoader(provider);

    const result = await loader.loadEntity(Post as any, 1, { strategy: LoadingStrategy.Eager });

    expect(provider.queryJunction).toHaveBeenCalledWith({
      table: 'post_tags',
      selectColumns: ['tagId'],
      whereColumn: 'postId',
      whereValues: [1]
    });
    expect(provider.findWhereIn).toHaveBeenCalledWith(Tag, 'id', [100, 200]);
    expect((result as any).tags).toEqual(tags);
  });

  it('eager-loads many-to-many collections in batch and groups by source', async () => {
    const posts = [{ id: 1 }, { id: 2 }] as any[];
    const tags = [
      { id: 100, name: 'ts' },
      { id: 200, name: 'sql' }
    ];
    const provider = makeProvider({
      findAll: jest.fn().mockResolvedValue(posts),
      queryJunction: jest.fn().mockResolvedValue([
        { postId: 1, tagId: 100 },
        { postId: 2, tagId: 200 }
      ]),
      findWhereIn: jest.fn().mockResolvedValue(tags)
    });
    const loader = new EntityLoader(provider);

    const result = await loader.loadEntities(Post as any, { strategy: LoadingStrategy.Eager });

    expect(provider.queryJunction).toHaveBeenCalledWith({
      table: 'post_tags',
      selectColumns: ['postId', 'tagId'],
      whereColumn: 'postId',
      whereValues: [1, 2]
    });
    expect((result[0] as any).tags).toEqual([tags[0]]);
    expect((result[1] as any).tags).toEqual([tags[1]]);
  });
});
