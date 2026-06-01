import type { CompiledModel } from '../src';
import {
  CompiledModelHydrationError,
  CompiledModelVersionError,
  createMetadataRegistry,
  loadCompiledModel
} from '../src';

class User {
  id!: number;
  name!: string;
}

class Post {
  id!: number;
  title!: string;
}

const baseModel: CompiledModel = {
  version: 1,
  contextClassName: 'AppContext',
  generatedAt: '2026-06-01T00:00:00.000Z',
  entities: [
    {
      entityClassName: 'User',
      tableName: 'users',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'int', nullable: false, primaryKey: true },
        { propertyName: 'name', columnName: 'name', type: 'varchar', nullable: false }
      ],
      relationships: [],
      indexes: []
    }
  ]
};

describe('loadCompiledModel', () => {
  it('hydrates a registry from a compiled model', () => {
    const registry = createMetadataRegistry();
    loadCompiledModel(baseModel, { User }, registry);

    const entities = registry.getEntities();
    expect(entities).toHaveLength(1);
    expect(entities[0].tableName).toBe('users');
    expect(entities[0].primaryKeys).toEqual(['id']);
    expect(entities[0].columns).toHaveLength(2);
  });

  it('throws CompiledModelVersionError when version is not 1', () => {
    const badModel = { ...baseModel, version: 2 } as unknown as CompiledModel;
    const registry = createMetadataRegistry();

    expect(() => loadCompiledModel(badModel, { User }, registry)).toThrow(
      CompiledModelVersionError
    );
  });

  it('throws CompiledModelHydrationError when entity class is missing from classMap', () => {
    const registry = createMetadataRegistry();

    expect(() => loadCompiledModel(baseModel, {}, registry)).toThrow(CompiledModelHydrationError);
    expect(() => loadCompiledModel(baseModel, {}, registry)).toThrow(/class "User".*classMap/);
  });

  it('hydrates shadowProperties from array to Map', () => {
    const model: CompiledModel = {
      ...baseModel,
      entities: [
        {
          ...baseModel.entities[0],
          shadowProperties: [
            {
              propertyName: 'createdAt',
              columnName: 'created_at',
              type: 'datetime',
              nullable: false
            }
          ]
        }
      ]
    };

    const registry = createMetadataRegistry();
    loadCompiledModel(model, { User }, registry);

    const entity = registry.getEntity(User);
    expect(entity?.shadowProperties).toBeInstanceOf(Map);
    expect(entity?.shadowProperties?.get('createdAt')).toMatchObject({
      propertyName: 'createdAt',
      columnName: 'created_at'
    });
  });

  it('hydrates multiple entities with relationships', () => {
    const model: CompiledModel = {
      version: 1,
      contextClassName: 'AppContext',
      generatedAt: '2026-06-01T00:00:00.000Z',
      entities: [
        {
          entityClassName: 'User',
          tableName: 'users',
          primaryKeys: ['id'],
          columns: [{ propertyName: 'id', columnName: 'id', type: 'int', nullable: false }],
          relationships: [
            {
              propertyName: 'posts',
              type: 'one-to-many',
              targetEntity: 'Post',
              inverseSide: 'user'
            }
          ],
          indexes: []
        },
        {
          entityClassName: 'Post',
          tableName: 'posts',
          primaryKeys: ['id'],
          columns: [{ propertyName: 'id', columnName: 'id', type: 'int', nullable: false }],
          relationships: [],
          indexes: []
        }
      ]
    };

    const registry = createMetadataRegistry();
    loadCompiledModel(model, { User, Post }, registry);

    const entities = registry.getEntities();
    expect(entities).toHaveLength(2);

    const userEntity = registry.getEntity(User);
    expect(userEntity?.relationships[0].targetEntity).toBe(Post);
  });

  it('hydrates schema, isKeyless, viewName', () => {
    const model: CompiledModel = {
      ...baseModel,
      entities: [
        {
          ...baseModel.entities[0],
          schema: 'dbo',
          isKeyless: true,
          viewName: 'v_users'
        }
      ]
    };

    const registry = createMetadataRegistry();
    loadCompiledModel(model, { User }, registry);

    const entity = registry.getEntity(User);
    expect(entity?.schema).toBe('dbo');
    expect(entity?.isKeyless).toBe(true);
    expect(entity?.viewName).toBe('v_users');
  });
});
