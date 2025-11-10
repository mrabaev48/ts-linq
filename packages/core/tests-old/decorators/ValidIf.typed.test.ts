import 'reflect-metadata';
import { DbContext } from '../../src/context/DbContext';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata } from '../../src/types';
import { ValidationError } from '../../src/types';
import { DatabaseProvider } from '../../src/DatabaseProvider';
import type { SqlDialect } from '../../src/query/SqlDialect';
import {
  ValidIfOf,
  RequiredIfOf,
  MinLengthOf,
  MaxLengthOf,
  PatternOf,
  RangeOf,
  ValidIf
} from '../../src/decorators/ValidIf';

type Stage3FieldContext = {
  kind: 'field';
  name: string | symbol;
  addInitializer: (fn: (this: unknown) => void) => void;
};
type Stage3FieldDecorator = (targetOrValue: unknown, context: Stage3FieldContext) => void;

class ProviderStub extends DatabaseProvider {
  constructor() {
    super('');
    this.providerName = 'test';
  }
  public async connect(): Promise<void> {
    this.isConnected = true;
  }
  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }
  public async createTable(): Promise<void> {
    /* no-op */
  }
  public getDialect(): SqlDialect {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete<T extends object>(): Promise<void> {
    /* no-op */
  }
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
  public async beginTransaction(): Promise<void> {
    this.inTransaction = true;
  }
  public async commitTransaction(): Promise<void> {
    this.inTransaction = false;
  }
  public async rollbackTransaction(): Promise<void> {
    this.inTransaction = false;
  }
}

class Product {
  id!: number;
  title!: string;
  price!: number;
  status!: 'draft' | 'published';
}

class Ctx extends DbContext {
  constructor() {
    super({ provider: new ProviderStub() });
  }
}

describe('Typed ValidIf helpers', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Product, 'Products');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      // nullable true to allow conditional required rules (avoid base NotNull masking ValidIf)
      { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: true, length: 50 },
      { propertyName: 'price', columnName: 'price', type: 'NUMBER', nullable: false },
      { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(Product, c));
    MetadataStorage.addPrimaryKey(Product, 'id');
    // Simulate decorators usage via metadata
    // 1) RequiredIf: title required when status is 'published'
    (RequiredIfOf<Product>((p) => p.status === 'published') as unknown as Stage3FieldDecorator)(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn) => fn.call(Product.prototype)
      } as Stage3FieldContext
    );
    // 2) RangeOf for price (>= 0)
    (RangeOf<Product>(0) as unknown as Stage3FieldDecorator)(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'price',
        addInitializer: (fn) => fn.call(Product.prototype)
      } as Stage3FieldContext
    );
  });

  test('RequiredIfOf enforces conditionally', async () => {
    const ctx = new Ctx();
    const set = ctx.set(Product);
    const p = new Product();
    p.status = 'published';
    p.price = 10;
    // title is missing -> should fail
    set.add(p);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('RangeOf validates numeric boundary', async () => {
    const ctx = new Ctx();
    const set = ctx.set(Product);
    const p = new Product();
    p.status = 'draft';
    p.title = 'ok';
    p.price = -1;
    set.add(p);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('ValidIf supports phases and i18n translation', async () => {
    class TCtx extends Ctx {
      constructor() {
        super();
        (
          this as unknown as { _validationOptions?: { translate?: (k: string) => string } }
        )._validationOptions = {
          translate: (k: string) => (k === 'err.title.required' ? 'Title required (i18n)' : k)
        };
      }
    }
    const ctx = new TCtx();
    const set = ctx.set(Product);
    // onCreate: required title when published
    (
      ValidIf((e) => (e as Product).status !== 'published' || !!(e as Product).title, undefined, {
        phase: 'onCreate',
        messageKey: 'err.title.required'
      }) as unknown as Stage3FieldDecorator
    )(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn) => fn.call(Product.prototype)
      } as Stage3FieldContext
    );
    const p = new Product();
    p.status = 'published';
    p.price = 10;
    set.add(p);
    try {
      await ctx.saveChanges();
      fail('expected ValidationError');
    } catch (e) {
      const details: Array<{ message: string }> =
        (e as { details?: Array<{ message: string }> } | undefined)?.details || [];
      const hasRequired = details.some((d) => /required/i.test(d.message));
      expect(hasRequired).toBe(true);
    }
    await ctx.dispose();
  });
});
