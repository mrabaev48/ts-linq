import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata, MetadataSource } from '@ts-linq/types';

import { EntityLoader } from '../src/loading/EntityLoader';
import { LoadingStrategy } from '../src/loading/LoadingStrategy';
import { RelationshipLoader } from '../src/loading/RelationshipLoader';

/**
 * These tests prove the loading layer resolves entity metadata from the
 * injected {@link MetadataSource} port (Dependency Inversion) and never reaches
 * into the global `MetadataStorage` singleton when an explicit source is
 * supplied — the multi-tenant isolation guarantee for the loading layer.
 */

const wrapOne = <T extends object>(e: T) => e;
const wrapMany = <T extends object>(arr: T[]) => arr;

function makeProvider(overrides: Partial<Record<string, unknown>> = {}): any {
  return {
    findById: jest.fn(),
    findWhere: jest.fn(),
    findWhereIn: jest.fn(),
    findAll: jest.fn(),
    executeQuery: jest.fn(),
    queryJunction: jest.fn(),
    ...overrides
  };
}

/** Minimal in-memory fake of the read port, backed by a constructor → metadata map. */
class FakeMetadataSource implements MetadataSource {
  readonly getEntity = jest.fn((target: unknown): EntityMetadata | undefined =>
    this.map.get(target as Function)
  );

  constructor(private readonly map: Map<Function, EntityMetadata>) {}

  getEntities(): EntityMetadata[] {
    return Array.from(this.map.values());
  }
  getValidationRules(): never[] {
    return [];
  }
  getOwnedEntities(): never[] {
    return [];
  }
  getStoredProcedureMapping(): undefined {
    return undefined;
  }
}

class Author {}
class Post {}

function authorMeta(): EntityMetadata {
  return {
    target: Author,
    tableName: 'authors',
    columns: [{ propertyName: 'id', columnName: 'id', type: 'int' }],
    primaryKeys: ['id'],
    relationships: [
      { propertyName: 'posts', type: 'one-to-many', targetEntity: Post, foreignKey: 'authorId' }
    ]
  } as unknown as EntityMetadata;
}

describe('Loader metadata injection (Dependency Inversion)', () => {
  let getInstanceSpy: jest.SpyInstance;

  beforeEach(() => {
    getInstanceSpy = jest.spyOn(MetadataStorage, 'getInstance');
  });

  afterEach(() => {
    getInstanceSpy.mockRestore();
  });

  it('RelationshipLoader resolves from the injected source, never the global singleton', async () => {
    const source = new FakeMetadataSource(new Map([[Author, authorMeta()]]));
    const posts = [{ id: 1, authorId: 10, title: 'A' }];
    const provider = makeProvider({ findWhere: jest.fn().mockResolvedValue(posts) });

    const loader = new RelationshipLoader(provider, wrapOne as any, wrapMany as any, source);
    const result = await loader.loadSingle(
      { id: 10 },
      Author as any,
      {
        propertyName: 'posts',
        type: 'one-to-many',
        targetEntity: Post,
        foreignKey: 'authorId'
      } as any
    );

    expect(source.getEntity).toHaveBeenCalledWith(Author);
    expect(getInstanceSpy).not.toHaveBeenCalled();
    expect(result).toEqual(posts);
  });

  it('EntityLoader resolves from the injected source, never the global singleton', async () => {
    const source = new FakeMetadataSource(new Map([[Author, authorMeta()]]));
    const author = { id: 10 };
    const posts = [{ id: 1, authorId: 10 }];
    const provider = makeProvider({
      findById: jest.fn().mockResolvedValue(author),
      findWhere: jest.fn().mockResolvedValue(posts)
    });

    const loader = new EntityLoader(provider, undefined, source);
    const loaded = await loader.loadEntity(Author as any, 10, { strategy: LoadingStrategy.Eager });

    expect(source.getEntity).toHaveBeenCalledWith(Author);
    expect(getInstanceSpy).not.toHaveBeenCalled();
    expect((loaded as any).posts).toEqual(posts);
  });

  it('two distinct sources stay isolated through the loading layer', async () => {
    // Tenant A: Author is registered (with PK metadata) → relationship loads.
    const sourceA = new FakeMetadataSource(new Map([[Author, authorMeta()]]));
    // Tenant B: same Author class, but UNKNOWN to this source → loads nothing.
    const sourceB = new FakeMetadataSource(new Map());

    const providerA = makeProvider({ findWhere: jest.fn().mockResolvedValue([{ id: 1 }]) });
    const providerB = makeProvider({ findWhere: jest.fn().mockResolvedValue([{ id: 1 }]) });

    const loaderA = new RelationshipLoader(providerA, wrapOne as any, wrapMany as any, sourceA);
    const loaderB = new RelationshipLoader(providerB, wrapOne as any, wrapMany as any, sourceB);

    const rel = {
      propertyName: 'posts',
      type: 'one-to-many',
      targetEntity: Post,
      foreignKey: 'authorId'
    } as any;

    const resultA = await loaderA.loadSingle({ id: 10 }, Author as any, rel);
    const resultB = await loaderB.loadSingle({ id: 10 }, Author as any, rel);

    // Identical call + identical provider data, but the outcome diverges purely
    // because each loader consulted ITS OWN injected source — proving isolation.
    expect(sourceA.getEntity).toHaveBeenCalledWith(Author);
    expect(sourceB.getEntity).toHaveBeenCalledWith(Author);
    expect(getInstanceSpy).not.toHaveBeenCalled();
    expect(resultA).toEqual([{ id: 1 }]);
    expect(resultB).toBeNull(); // Author unknown to source B → no load
    expect(providerB.findWhere).not.toHaveBeenCalled();
  });
});
