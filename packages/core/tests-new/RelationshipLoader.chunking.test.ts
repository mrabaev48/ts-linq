import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';

import { RelationshipLoader } from '../src/loading/RelationshipLoader';
import { DEFAULT_IN_CHUNK_SIZE } from '../src/loading/support/InClauseChunker';

const wrapOne = <T extends object>(e: T) => e;
const wrapMany = <T extends object>(arr: T[]) => arr;

class Author {}
class Post {}

function registerEntities() {
  MetadataStorage.reset();
  MetadataStorage.addEntity(Author, 'authors');
  MetadataStorage.addColumn(Author, { propertyName: 'id', columnName: 'id', type: 'int' } as any);
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
  MetadataStorage.addPrimaryKey(Post, 'id');
}

describe('RelationshipLoader – IN-chunking (folded-in capability)', () => {
  beforeEach(() => registerEntities());
  afterEach(() => MetadataStorage.reset());

  it('splits a large batched one-to-many IN list across chunks', async () => {
    const total = DEFAULT_IN_CHUNK_SIZE + 500; // 1500 → two chunks at the default size
    const authors = Array.from({ length: total }, (_, i) => ({ id: i + 1 })) as any[];

    const findWhereIn = jest.fn(
      async (_ctor: unknown, _column: string, _values: unknown[]) => [] as unknown[]
    );
    const crossQuery = jest.fn();
    const provider = {
      findById: jest.fn(),
      findWhere: jest.fn(),
      findWhereIn,
      queryJunction: jest.fn(),
      loggerRef: { crossQuery },
      providerLabel: 'test'
    } as never;

    const loader = new RelationshipLoader(provider, wrapOne as never, wrapMany as never);

    await loader.loadBatch(
      authors,
      Author as never,
      {
        propertyName: 'posts',
        type: 'one-to-many',
        targetEntity: Post,
        foreignKey: 'authorId'
      } as never
    );

    expect(findWhereIn).toHaveBeenCalledTimes(2);
    expect((findWhereIn.mock.calls[0][2] as unknown[]).length).toBe(DEFAULT_IN_CHUNK_SIZE);
    expect((findWhereIn.mock.calls[1][2] as unknown[]).length).toBe(500);
    expect(crossQuery).toHaveBeenCalledTimes(1);
    // Every parent still gets an (empty) collection assigned.
    expect(authors.every((a) => Array.isArray(a.posts) && a.posts.length === 0)).toBe(true);
  });
});
