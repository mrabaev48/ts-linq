import { SQLiteProvider } from '@ts-linq/provider-sqlite';
import { shouldRunSqlite } from '../_utils/env';
import { MetadataStorage } from '@ts-linq/metadata';
import type { DbSet } from '@ts-linq/orm';
import { DbContext } from '@ts-linq/orm';
import { LazyLoadingProxy, awaitLazyLoad } from '@ts-linq/core';

class User {
  id!: number;
  name!: string;
  roles?: Role[];
}

class Role {
  id!: number;
  name!: string;
}

// Register metadata manually for Stage-3 compatibility
MetadataStorage.addEntity(User, 'users');
MetadataStorage.addPrimaryKey(User, 'id');
MetadataStorage.addColumn(User, { propertyName: 'id', columnName: 'id', type: 'INTEGER' } as any);
MetadataStorage.addColumn(User, { propertyName: 'name', columnName: 'name', type: 'TEXT' } as any);
MetadataStorage.addRelationship(User, {
  propertyName: 'roles',
  type: 'many-to-many',
  targetEntity: Role,
  through: { table: 'user_roles', sourceFk: 'userId', targetFk: 'roleId' }
} as any);

MetadataStorage.addEntity(Role, 'roles');
MetadataStorage.addPrimaryKey(Role, 'id');
MetadataStorage.addColumn(Role, { propertyName: 'id', columnName: 'id', type: 'INTEGER' } as any);
MetadataStorage.addColumn(Role, { propertyName: 'name', columnName: 'name', type: 'TEXT' } as any);

class TestContext extends DbContext {
  users!: DbSet<User>;
  roles!: DbSet<Role>;
}

const run = shouldRunSqlite;
(run ? describe : describe.skip)('SQLite many-to-many integration', () => {
  let provider: SQLiteProvider;
  let ctx: TestContext;

  beforeAll(async () => {
    provider = new SQLiteProvider({ file: ':memory:' });
    await provider.connect();
    // DbContext constructor expects { provider } as DbContextOptions
    // but TestContext has no own constructor; create wrapper subclass:
    class _Ctx extends DbContext {
      constructor() {
        super({ provider });
      }
    }
    ctx = new _Ctx() as unknown as TestContext;
    await ctx.ensureCreated();

    // Create junction table
    await provider.executeNonQuery(
      `CREATE TABLE user_roles (userId INTEGER, roleId INTEGER, PRIMARY KEY (userId, roleId))`
    );

    // Seed data
    await provider.executeNonQuery(`INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob')`);
    await provider.executeNonQuery(
      `INSERT INTO roles (id, name) VALUES (10, 'Admin'), (11, 'User'), (12, 'Guest')`
    );
    await provider.executeNonQuery(
      `INSERT INTO user_roles (userId, roleId) VALUES (1, 10), (1, 11), (2, 11)`
    );
  });

  afterAll(async () => {
    await provider.disconnect();
  });

  test('lazy loads m2m collection via join table', async () => {
    const user = await provider.findById<User>(1, User);
    expect(user).not.toBeNull();
    const proxy = LazyLoadingProxy.create(user!, User, provider);
    const roles = await awaitLazyLoad((proxy as any).roles);
    expect(Array.isArray(roles)).toBe(true);
    expect(roles).toHaveLength(2);
    expect(roles.map((r: Role) => r.name).sort()).toEqual(['Admin', 'User']);
  });

  test('batched m2m preload for multiple entities', async () => {
    const users = await provider.findAll<User>(User);
    const proxies = LazyLoadingProxy.createMany(users, User, provider);
    await LazyLoadingProxy.preloadRelationships(proxies, User, ['roles'], provider);
    const alice = proxies.find((u: User) => u.id === 1);
    const bob = proxies.find((u: User) => u.id === 2);
    expect(alice?.roles).toHaveLength(2);
    expect(bob?.roles).toHaveLength(1);
    expect(bob?.roles?.[0]?.name).toBe('User');
  });

  test('m2m with no related entities returns empty array', async () => {
    await provider.executeNonQuery(`INSERT INTO users (id, name) VALUES (99, 'Orphan')`);
    const user = await provider.findById<User>(99, User);
    const proxy = LazyLoadingProxy.create(user!, User, provider);
    const roles = await awaitLazyLoad((proxy as any).roles);
    expect(roles).toEqual([]);
  });
});
