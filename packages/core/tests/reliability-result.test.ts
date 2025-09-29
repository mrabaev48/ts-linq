import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { DbSet } from '../src/context/DbSet';
import { DatabaseProvider } from '../src/DatabaseProvider';
import type { SqlDialect } from '../src/query/SqlDialect';
import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';

@Entity({ name: 'Items' })
class Item {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class TestContext extends DbContext {
  public items!: DbSet<Item>; // auto DbSet
  constructor() {
    const provider = new (class extends DatabaseProvider {
      public async connect(): Promise<void> {}
      public async disconnect(): Promise<void> {}
      public async createTable(): Promise<void> {}
      public getDialect(): SqlDialect {
        return { buildSelect: () => ({ query: 'SELECT 1', parameters: [] }) } as any;
      }
      public async insert<T extends object>(e: T): Promise<T> {
        return e;
      }
      public async update<T extends object>(e: T): Promise<T> {
        return e;
      }
      public async delete<T extends object>(): Promise<void> {}
      public async findById<T extends object>(): Promise<T | null> {
        return null;
      }
      public async findAll<T extends object>(): Promise<T[]> {
        return [];
      }
      public async findWhere<T extends object>(): Promise<T[]> {
        return [];
      }
      public async findWhereIn<T extends object>(): Promise<T[]> {
        return [];
      }
      protected async doExecuteQuery<T>(): Promise<T[]> {
        return [];
      }
      protected async doExecuteNonQuery(): Promise<number> {
        return 0;
      }
      public async beginTransaction(): Promise<void> {}
      public async commitTransaction(): Promise<void> {}
      public async rollbackTransaction(): Promise<void> {}
    })('');
    super({ provider } as any);
  }
}

describe('Result-based try methods', () => {
  test('trySaveChanges returns ok on success', async () => {
    // Ensure metadata is rehydrated before context initialization
    new Item();
    const ctx = new TestContext();
    await ctx.ensureCreated();
    const item = new Item();
    item.name = 'ok';
    ctx.set(Item).add(item);
    const res = await ctx.trySaveChanges();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
