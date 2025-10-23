import type { DbSet } from '@ts-linq/core';
import { DbContext, type EntityId, MetadataStorage } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/provider-sqlite';
import path from 'node:path';
import fs from 'node:fs';

// Define branded id alias for usage at call sites
type UserId = EntityId<number, 'User'>;

const dbPath = path.resolve(process.cwd(), 'tests/tmp/sqlite-branded.db');

class User {
  id!: number;
  name!: string;
}

class AppCtx extends DbContext {
  public users!: DbSet<User>;
  constructor(conn: string) {
    super({ provider: new SQLiteProvider(conn) });
  }
}

describe('SQLite branded ID integration', () => {
  beforeAll(() => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });
  afterAll(() => {
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });

  test('insert and find by branded id and findByIds', async () => {
    // Register metadata manually instead of decorators
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(User, 'Users');
    MetadataStorage.addColumn(User, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true,
      isBranded: true,
      brand: 'User'
    });
    MetadataStorage.addColumn(User, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(User, 'id');

    const ctx = new AppCtx(dbPath);
    await ctx.ensureCreated();

    const u = new User();
    u.name = 'Alice';
    ctx.set(User).add(u);
    await ctx.saveChanges();

    const one = await ctx.set(User).find(u.id as UserId);
    expect(one?.name).toBe('Alice');

    const many = await ctx.set(User).findByIds([u.id as UserId]);
    expect(many.length).toBe(1);

    await ctx.dispose();
  });
});
