import { DbContext } from '@ts-linq/orm';
import { MetadataStorage } from '@ts-linq/metadata';
import { ValidationError } from '@ts-linq/types';
import type { ColumnMetadata } from '@ts-linq/types';
import { MySqlProvider } from '@ts-linq/provider-mysql';
import { ValidIfOf, RequiredIfOf } from '@ts-linq/core';

class Product {
  id!: number;
  title!: string;
  status!: 'draft' | 'published';
}

class MyCtx extends DbContext {
  constructor(url: string) {
    super({
      provider: new MySqlProvider({
        host: process.env.MYSQL_HOST || 'localhost',
        port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
        database: process.env.MYSQL_DB || 'test',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD
      }) as any
    });
  }
}

describe('[integration][mysql] Conditional Validation with real DB', () => {
  const url = process.env.MYSQL_URL;
  if (!url) {
    test.skip('skipped — no MYSQL_URL provided', () => {});
    return;
  }

  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Product, 'Products');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false, length: 100 },
      { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(Product, c));
    MetadataStorage.addPrimaryKey(Product, 'id');
    RequiredIfOf<Product>((p: Product) => p.status === 'published', 'Title required for published')(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Product.prototype)
      } as any
    );
    ValidIfOf<Product>(
      (p: Product) => p.status !== 'published' || (p.title || '').includes(' '),
      'Title must contain space when published'
    )(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Product.prototype)
      } as any
    );
  });

  test('rejects invalid entity', async () => {
    const ctx = new MyCtx(url);
    await ctx.ensureCreated();
    const set = ctx.set(Product);
    const p = new Product();
    p.status = 'published';
    set.add(p);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('inserts valid entity', async () => {
    const ctx = new MyCtx(url);
    await ctx.ensureCreated();
    const set = ctx.set(Product);
    const p = new Product();
    p.status = 'published';
    p.title = 'Hello World';
    set.add(p);
    await expect(ctx.saveChanges()).resolves.toBeGreaterThan(0);
    await ctx.dispose();
  });
});
