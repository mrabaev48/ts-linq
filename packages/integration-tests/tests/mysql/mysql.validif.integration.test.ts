import 'reflect-metadata';
import {
  DbContext,
  MetadataStorage,
  ValidationError,
  ValidIfOf,
  RequiredIfOf
} from '@ts-linq/core';
import type { ColumnMetadata } from '@ts-linq/core';
import { MySqlProvider } from '@ts-linq/provider-mysql';

class Article {
  id!: number;
  title!: string;
  status!: 'draft' | 'published';
}

class MyCtx extends DbContext {
  constructor(url: string) {
    super({ provider: new MySqlProvider(url) as any });
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
    MetadataStorage.addEntity(Article, 'Articles');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false, length: 100 },
      { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(Article, c));
    MetadataStorage.addPrimaryKey(Article, 'id');
    RequiredIfOf<Article>((a: Article) => a.status === 'published', 'Title required for published')(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Article.prototype)
      } as any
    );
    ValidIfOf<Article>(
      (a: Article) => a.status !== 'published' || (a.title || '').includes(' '),
      'Title must contain space when published'
    )(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Article.prototype)
      } as any
    );
  });

  test('rejects invalid entity', async () => {
    const ctx = new MyCtx(url);
    await ctx.ensureCreated();
    const set = ctx.set(Article);
    const a = new Article();
    a.status = 'published';
    set.add(a);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('inserts valid entity', async () => {
    const ctx = new MyCtx(url);
    await ctx.ensureCreated();
    const set = ctx.set(Article);
    const a = new Article();
    a.status = 'published';
    a.title = 'Hello World';
    set.add(a);
    await expect(ctx.saveChanges()).resolves.toBeGreaterThan(0);
    await ctx.dispose();
  });
});
