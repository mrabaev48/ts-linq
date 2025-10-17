import { DbContext } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata } from '@ts-linq/core';
import { ValidationError } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';
import { ValidIfOf, RequiredIfOf } from '@ts-linq/core';

class Post {
  id!: number;
  title!: string;
  status!: 'draft' | 'published';
}

class SqliteCtx extends DbContext {
  constructor() {
    super({ provider: new SQLiteProvider(':memory:') as any });
  }
}

describe('[integration][sqlite] Conditional Validation with real DB', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Post, 'Posts');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false, length: 100 },
      { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(Post, c));
    MetadataStorage.addPrimaryKey(Post, 'id');
    // Decorators (Stage-3) simulation: title required when published
    RequiredIfOf<Post>((p: Post) => p.status === 'published', 'Title required for published')(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Post.prototype)
      } as any
    );
    // Custom predicate: title must contain a space when published
    ValidIfOf<Post>(
      (p: Post) => p.status !== 'published' || (p.title || '').includes(' '),
      'Title must contain space when published'
    )(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Post.prototype)
      } as any
    );
  });

  test('failing entity is rejected before any SQL is executed', async () => {
    const ctx = new SqliteCtx();
    await ctx.ensureCreated();
    const set = ctx.set(Post);
    const p = new Post();
    p.status = 'published'; // title missing
    set.add(p);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('passing entity is inserted successfully', async () => {
    const ctx = new SqliteCtx();
    await ctx.ensureCreated();
    const set = ctx.set(Post);
    const p = new Post();
    p.status = 'published';
    p.title = 'Hello World';
    set.add(p);
    await expect(ctx.saveChanges()).resolves.toBeGreaterThan(0);
    await ctx.dispose();
  });
});
