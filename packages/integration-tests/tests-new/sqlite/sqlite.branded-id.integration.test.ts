import type { DbSet } from '@ts-linq/orm';
import { DbContext } from '@ts-linq/orm';
import { MetadataStorage } from '@ts-linq/metadata';
import { SQLiteProvider } from '@ts-linq/provider-sqlite';
import { shouldRunSqlite } from '../_utils/env';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = path.resolve(process.cwd(), 'tests/tmp/sqlite-branded.db');

class User {
  id!: number;
  name!: string;
}

class AppCtx extends DbContext {
  public users!: DbSet<User>;
  constructor(conn: string) {
    super({ provider: new SQLiteProvider({ file: conn }) });
  }
}

const run = shouldRunSqlite;
(run ? describe : describe.skip)('SQLite branded ID integration', () => {
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
      isGenerated: true
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

    const one = await ctx.set(User).find(u.id);
    expect(one?.name).toBe('Alice');

    const many = await ctx.set(User).findByIds([u.id]);
    expect(many.length).toBe(1);

    await ctx.dispose();
  });
});
