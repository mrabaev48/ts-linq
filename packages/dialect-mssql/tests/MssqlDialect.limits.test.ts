import { MetadataStorage, QueryBuilder, type QueryOptions } from '@ts-linq/core';
import { MssqlDialect } from '../src';

class U { id!: number; name!: string }

beforeEach(() => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(U, 'Users');
  MetadataStorage.addColumn(U, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true });
  MetadataStorage.addColumn(U, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
  MetadataStorage.addPrimaryKey(U, 'id');
});

test('limit without offset uses TOP(n)', () => {
  const qb = new QueryBuilder(new MssqlDialect());
  const built = qb.generateSql(U as any, { select: ['id'], limit: 10 } as unknown as QueryOptions);
  expect(built.query.startsWith('SELECT TOP (10) ')).toBe(true);
});

test('offset with order fallback and fetch next', () => {
  const qb = new QueryBuilder(new MssqlDialect());
  const built = qb.generateSql(U as any, { select: ['id'], offset: 5, limit: 3 } as any);
  expect(built.query).toContain('ORDER BY (SELECT NULL)');
  expect(built.query).toContain('OFFSET 5 ROWS FETCH NEXT 3 ROWS ONLY');
});


