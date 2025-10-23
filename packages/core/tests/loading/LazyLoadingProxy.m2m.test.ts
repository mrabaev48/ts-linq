import 'reflect-metadata';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import { LazyLoadingProxy, awaitLazyLoad } from '../../src/loading/LazyLoadingProxy';
import type { DatabaseProvider } from '../../src/DatabaseProvider';

function providerStub(rows: Array<{ s: unknown; t: unknown }>, related: any[]) {
  return {
    providerLabel: 'sqlite',
    executeQuery: vi.fn(async () => rows),
    findWhereIn: vi.fn(async () => related)
  } as unknown as jest.Mocked<DatabaseProvider>;
}

describe('LazyLoadingProxy many-to-many', () => {
  class Role {
    id!: number;
    name!: string;
  }
  class User {
    id!: number;
    roles?: Role[];
  }

  beforeEach(() => {
    (MetadataStorage as unknown as { getInstance: () => MetadataStorage }).getInstance().clear();
    // User
    MetadataStorage.addEntity(User, 'Users');
    MetadataStorage.addPrimaryKey(User, 'id');
    MetadataStorage.addColumn(User, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER'
    } as any);
    // Role
    MetadataStorage.addEntity(Role, 'Roles');
    MetadataStorage.addPrimaryKey(Role, 'id');
    MetadataStorage.addColumn(Role, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER'
    } as any);
    // M2M User.roles through UserRoles(userId, roleId)
    MetadataStorage.addRelationship(User, {
      propertyName: 'roles',
      type: 'many-to-many',
      targetEntity: Role,
      through: { table: 'UserRoles', sourceFk: 'userId', targetFk: 'roleId' }
    } as any);
  });

  test('loads m2m via join table and findWhereIn', async () => {
    const user = { id: 1 } as User;
    const provider = providerStub(
      [{ id: 10 }, { id: 11 }],
      [
        { id: 10, name: 'admin' },
        { id: 11, name: 'user' }
      ]
    );
    const proxy = LazyLoadingProxy.create(user, User, provider);
    const result = await awaitLazyLoad((proxy as any).roles);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });
});
