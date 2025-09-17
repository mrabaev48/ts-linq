import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey, type EntityId } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';

// Define branded id alias
type UserId = EntityId<number, 'User'>;

@Entity({ name: 'Users' })
class User {
  @PrimaryKey({ autoIncrement: true, branded: true }) id!: UserId;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class AppCtx extends DbContext {
  public users!: DbSet<User>;
  constructor() {
    super({ provider: new SQLiteProvider(':memory:') });
  }
}

describe('SQLite branded ID integration', () => {
  test('insert and find by branded id and findByIds', async () => {
    const ctx = new AppCtx();
    await ctx.ensureCreated();

    const u = new User();
    u.name = 'Alice';
    ctx.users.add(u);
    await ctx.saveChanges();

    const one = await ctx.users.find(u.id);
    expect(one?.name).toBe('Alice');

    const many = await ctx.users.findByIds([u.id]);
    expect(many.length).toBe(1);

    await ctx.dispose();
  });
});
