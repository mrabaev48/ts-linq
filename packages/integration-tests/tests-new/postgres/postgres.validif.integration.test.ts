import { DbContext } from '@ts-linq/orm';
import { MetadataStorage } from '@ts-linq/metadata';
import { ValidationError } from '@ts-linq/types';
import type { ColumnMetadata } from '@ts-linq/types';
import { PostgresProvider } from '@ts-linq/provider-postgres';
import { ValidIfOf, RequiredIfOf } from '@ts-linq/core';

class Article {
  id!: number;
  title!: string;
  status!: 'draft' | 'published';
}

class PgCtx extends DbContext {
  constructor(url: string) {
    super({
      provider: new PostgresProvider({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
        database: process.env.POSTGRES_DB || 'test',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD
      }) as any
    });
  }
}

describe('[integration][postgres] Conditional Validation with real DB', () => {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    test.skip('skipped — no POSTGRES_URL provided', () => {});
    return;
  }

  const providerConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
    database: process.env.POSTGRES_DB || 'test',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD
  } as const;

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

  beforeEach(async () => {
    // Ensure schema is recreated with correct identity/defaults.
    // `ensureCreated()` uses `CREATE TABLE IF NOT EXISTS`, so we must drop first to avoid stale schema.
    const p = new PostgresProvider(providerConfig);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "Articles"');
    } finally {
      await p.disconnect();
    }
  });

  test('rejects invalid entity', async () => {
    const ctx = new PgCtx(url);
    await ctx.ensureCreated();
    const set = ctx.set(Article);
    const a = new Article();
    a.status = 'published';
    set.add(a);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('inserts valid entity', async () => {
    const ctx = new PgCtx(url);
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
