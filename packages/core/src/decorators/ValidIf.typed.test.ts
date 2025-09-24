import 'reflect-metadata';
import { DbContext } from '../context/DbContext';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnMetadata } from '../types';
import { ValidationError } from '../types';
import { DatabaseProvider } from '../DatabaseProvider';
import type { SqlDialect } from '../query/SqlDialect';
import { ValidIfOf, RequiredIfOf, MinLengthOf, MaxLengthOf, PatternOf, RangeOf } from './ValidIf';

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

class Product {
  id!: number;
  title!: string;
  price!: number;
  status!: 'draft' | 'published';
}

class Ctx extends DbContext { constructor() { super({ provider: new ProviderStub() }); } }

describe('Typed ValidIf helpers', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Product, 'Products');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false, length: 50 },
      { propertyName: 'price', columnName: 'price', type: 'NUMBER', nullable: false },
      { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false }
    ];
    cols.forEach(c => MetadataStorage.addColumn(Product, c));
    MetadataStorage.addPrimaryKey(Product, 'id');
    // Simulate decorators usage via metadata
    // 1) RequiredIf: title required when status is 'published'
    RequiredIfOf<Product>(p => p.status === 'published')(
      undefined as unknown as object,
      { kind: 'field', name: 'title', addInitializer: (fn: (this: unknown) => void) => fn.call(Product.prototype) } as any
    );
    // 2) RangeOf for price (>= 0)
    RangeOf<Product>(0)(
      undefined as unknown as object,
      { kind: 'field', name: 'price', addInitializer: (fn: (this: unknown) => void) => fn.call(Product.prototype) } as any
    );
  });

  test('RequiredIfOf enforces conditionally', async () => {
    const ctx = new Ctx(); const set = ctx.set(Product);
    const p = new Product(); p.status = 'published'; p.price = 10;
    // title is missing -> should fail
    set.add(p);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('RangeOf validates numeric boundary', async () => {
    const ctx = new Ctx(); const set = ctx.set(Product);
    const p = new Product(); p.status = 'draft'; p.title = 'ok'; p.price = -1;
    set.add(p);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });
});


