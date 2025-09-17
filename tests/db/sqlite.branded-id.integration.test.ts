import 'reflect-metadata';
import {
  DbContext,
  DbSet,
  Entity,
  Column,
  PrimaryKey,
  type EntityId,
  MetadataStorage
} from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';
import path from 'node:path';
import fs from 'node:fs';

// Define branded id alias for usage at call sites
type UserId = EntityId<number, 'User'>;

const dbPath = path.resolve(process.cwd(), 'tests/tmp/sqlite-branded.db');

@Entity({ name: 'Users' })
class User {
  @PrimaryKey({ autoIncrement: true, branded: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
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
    try { fs.unlinkSync(dbPath); } catch {}
  });
  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  test('insert and find by branded id and findByIds', async () => {
    // Trigger decorator initializers and finalize
    new User();
    MetadataStorage.getEntities();

    // Bootstrap schema explicitly to avoid race conditions
    const bootstrap = new SQLiteProvider(dbPath);
    await bootstrap.connect();
    await bootstrap.executeNonQuery(
      "CREATE TABLE IF NOT EXISTS Users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)"
    );
    await bootstrap.disconnect();

    const ctx = new AppCtx(dbPath);
    await ctx.ensureCreated();

    const u = new User();
    u.name = 'Alice';
    ctx.users.add(u);
    await ctx.saveChanges();

    const one = await ctx.users.find(u.id as UserId);
    expect(one?.name).toBe('Alice');

    const many = await ctx.users.findByIds([u.id as UserId]);
    expect(many.length).toBe(1);

    await ctx.dispose();
  });
});
