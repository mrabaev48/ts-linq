import 'reflect-metadata';
import { DbContext, MetadataStorage, ValidationError } from '@ts-linq/core';
import type { ColumnMetadata } from '@ts-linq/core';
import { MssqlProvider } from '@ts-linq/mssql';
import { ValidIfOf, RequiredIfOf } from '@ts-linq/core';

class Note {
  id!: number;
  title!: string;
  status!: 'draft' | 'published';
}

class MsCtx extends DbContext {
  constructor(url: string) {
    super({ provider: new MssqlProvider(url) as any });
  }
}

describe('[integration][mssql] Conditional Validation with real DB', () => {
  const url = process.env.MSSQL_URL;
  if (!url) {
    test.skip('skipped — no MSSQL_URL provided', () => {});
    return;
  }

  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Note, 'Notes');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false, length: 100 },
      { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(Note, c));
    MetadataStorage.addPrimaryKey(Note, 'id');
    RequiredIfOf<Note>((n: Note) => n.status === 'published', 'Title required for published')(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Note.prototype)
      } as any
    );
    ValidIfOf<Note>(
      (n: Note) => n.status !== 'published' || (n.title || '').includes(' '),
      'Title must contain space when published'
    )(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'title',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Note.prototype)
      } as any
    );
  });

  test('rejects invalid entity', async () => {
    const ctx = new MsCtx(url);
    await ctx.ensureCreated();
    const set = ctx.set(Note);
    const n = new Note();
    n.status = 'published';
    set.add(n);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('inserts valid entity', async () => {
    const ctx = new MsCtx(url);
    await ctx.ensureCreated();
    const set = ctx.set(Note);
    const n = new Note();
    n.status = 'published';
    n.title = 'Hello World';
    set.add(n);
    await expect(ctx.saveChanges()).resolves.toBeGreaterThan(0);
    await ctx.dispose();
  });
});
