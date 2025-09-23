import 'reflect-metadata';
import { DbContext } from '../context/DbContext';
import { DbSet } from '../context/DbSet';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnMetadata, SqlParameter } from '../types';
import { ValidationError } from '../types';
import { DatabaseProvider } from '../DatabaseProvider';
import type { SqlDialect } from '../query/SqlDialect';

class ProviderStub extends DatabaseProvider {
  constructor() { super(''); this.providerName = 'test'; }
  public async connect(): Promise<void> { this.isConnected = true; }
  public async disconnect(): Promise<void> { this.isConnected = false; }
  public async createTable(): Promise<void> { /* no-op */ }
  public getDialect(): SqlDialect { return { buildSelect: () => ({ query: '', parameters: [] }) }; }
  public async insert<T extends object>(e: T): Promise<T> { return e; }
  public async update<T extends object>(e: T): Promise<T> { return e; }
  public async delete<T extends object>(): Promise<void> { /* no-op */ }
  public async findById<T extends object>(): Promise<T | null> { return null; }
  public async findAll<T extends object>(): Promise<T[]> { return []; }
  public async findWhere<T extends object>(): Promise<T[]> { return []; }
  public async findWhereIn<T extends object>(): Promise<T[]> { return []; }
  protected async doExecuteQuery<T>(): Promise<T[]> { return []; }
  protected async doExecuteNonQuery(): Promise<number> { return 0; }
  public async beginTransaction(): Promise<void> { this.inTransaction = true; }
  public async commitTransaction(): Promise<void> { this.inTransaction = false; }
  public async rollbackTransaction(): Promise<void> { this.inTransaction = false; }
}

class Order { id!: number; amount!: number; status!: 'pending' | 'paid'; }

class Ctx extends DbContext { constructor() { super({ provider: new ProviderStub() }); } }

describe('ValidIf runtime (Stage-3 path stored via Reflect)', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Order, 'Orders');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'amount', columnName: 'amount', type: 'INTEGER', nullable: false },
      { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false },
    ];
    cols.forEach(c => MetadataStorage.addColumn(Order, c));
    MetadataStorage.addPrimaryKey(Order, 'id');
    // Simulate @ValidIf decorator storing validation rule on class
    const rules = [
      { propertyName: '_rule', predicate: (e: unknown) => (e as Order).status !== 'pending' || (e as Order).amount > 0, message: 'Pending requires positive amount' }
    ];
    Reflect.defineMetadata('orm:validations', rules, Order);
  });

  test('fails saveChanges when rule violated', async () => {
    const ctx = new Ctx(); const orders = ctx.set(Order);
    const o = new Order(); o.amount = 0; o.status = 'pending';
    orders.add(o);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('passes saveChanges when rule satisfied', async () => {
    const ctx = new Ctx(); const orders = ctx.set(Order);
    const o = new Order(); o.amount = 10; o.status = 'pending';
    orders.add(o);
    await expect(ctx.saveChanges()).resolves.toBeGreaterThanOrEqual(0);
    await ctx.dispose();
  });
});


