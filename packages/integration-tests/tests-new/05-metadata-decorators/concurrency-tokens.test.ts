import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { createMetadataRegistry } from '@ts-linq/metadata';
import { ModelBuilder } from '@ts-linq/orm';
import type { ColumnMetadata } from '@ts-linq/types';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PropertyBuilder — isConcurrencyToken / isRowVersion', () => {
  test('isConcurrencyToken() is fluent and sets flag', () => {
    const { PropertyBuilder } = require('@ts-linq/orm');
    const cols = new Map<string, ColumnMetadata>();
    const pb = new PropertyBuilder('title', cols);
    expect(pb.isConcurrencyToken()).toBe(pb);
    expect(cols.get('title')?.isConcurrencyToken).toBe(true);
  });

  test('isConcurrencyToken(false) clears flag', () => {
    const { PropertyBuilder } = require('@ts-linq/orm');
    const cols = new Map<string, ColumnMetadata>();
    const pb = new PropertyBuilder('title', cols);
    pb.isConcurrencyToken().isConcurrencyToken(false);
    expect(cols.get('title')?.isConcurrencyToken).toBe(false);
  });

  test('isRowVersion() sets isVersion + isConcurrencyToken', () => {
    const { PropertyBuilder } = require('@ts-linq/orm');
    const cols = new Map<string, ColumnMetadata>();
    const pb = new PropertyBuilder('version', cols);
    pb.isRowVersion();
    expect(cols.get('version')?.isVersion).toBe(true);
    expect(cols.get('version')?.isConcurrencyToken).toBe(true);
  });

  test('EntityTypeBuilder.property() returns PropertyBuilder with isConcurrencyToken', () => {
    class Post {
      id!: number;
      title!: string;
    }
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);
    const pb = mb.entity(Post).property((p) => p.title);
    expect(typeof pb.isConcurrencyToken).toBe('function');
    expect(pb.isConcurrencyToken()).toBe(pb);
  });
});

describe('SQL WHERE injection — concurrency tokens across dialects', () => {
  const mkMeta = (extraCols: ColumnMetadata[]) => ({
    tableName: 'articles',
    primaryKeys: ['id'],
    columns: [
      { propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true } as ColumnMetadata,
      ...extraCols
    ]
  });

  const titleToken: ColumnMetadata = {
    propertyName: 'title',
    columnName: 'title',
    type: 'TEXT',
    isConcurrencyToken: true
  } as ColumnMetadata;

  describe('PostgresDialect', () => {
    const d = new PostgresDialect();

    test('buildUpdate injects original value in WHERE', () => {
      const meta = mkMeta([titleToken]);
      const entity = { id: 1, title: 'New' };
      const orig = { title: 'Old' };
      const { sql, parameters } = (d as any).buildUpdate(
        entity,
        meta,
        undefined,
        [titleToken],
        orig
      );
      expect(sql).toContain('AND "title" = $');
      expect(parameters).toContain('Old');
    });

    test('buildDelete injects original value in WHERE', () => {
      const meta = mkMeta([titleToken]);
      const entity = { id: 1, title: 'Hello' };
      const orig = { title: 'Old title' };
      const { sql, parameters } = (d as any).buildDelete(entity, meta, [titleToken], orig);
      expect(sql).toContain('AND "title" = $');
      expect(parameters).toContain('Old title');
    });
  });

  describe('MysqlDialect', () => {
    const d = new MysqlDialect();

    test('buildUpdate injects original value', () => {
      const meta = mkMeta([titleToken]);
      const entity = { id: 1, title: 'New' };
      const orig = { title: 'Old' };
      const { sql, parameters } = (d as any).buildUpdate(
        entity,
        meta,
        undefined,
        [titleToken],
        orig
      );
      expect(sql).toContain('AND `title` = ?');
      expect(parameters).toContain('Old');
    });
  });

  describe('MssqlDialect', () => {
    const d = new MssqlDialect();

    test('buildUpdate injects original value', () => {
      const meta = mkMeta([titleToken]);
      const entity = { id: 1, title: 'New' };
      const orig = { title: 'Old' };
      const { sql, parameters } = (d as any).buildUpdate(
        entity,
        meta,
        undefined,
        [titleToken],
        orig
      );
      expect(sql).toContain('AND [title] = @p');
      expect(parameters).toContain('Old');
    });
  });
});

describe('DbUpdateConcurrencyException', () => {
  test('is exported from @ts-linq/orm and extends Error', () => {
    const { DbUpdateConcurrencyException } = require('@ts-linq/orm');
    const ex = new DbUpdateConcurrencyException('conflict', []);
    expect(ex).toBeInstanceOf(Error);
    expect(ex.name).toBe('DbUpdateConcurrencyException');
    expect(Array.isArray(ex.entries)).toBe(true);
  });
});
