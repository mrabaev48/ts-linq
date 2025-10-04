import { MetadataStorage, QueryBuilder, type QueryOptions } from '@ts-linq/core';
import { SQLiteDialect } from '../src';

class U { id!: number; name!: string }

beforeEach(() => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(U, 'users');
  MetadataStorage.addColumn(U, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true });
  MetadataStorage.addColumn(U, { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false });
  MetadataStorage.addPrimaryKey(U, 'id');
});

test('offset without limit inserts LIMIT -1', () => {
  const qb = new QueryBuilder(new SQLiteDialect());
  const built = qb.generateSql(U as any, { select: ['id'], offset: 10 } as unknown as QueryOptions);
  expect(built.query).toContain('LIMIT -1 OFFSET 10');
});

test('limit with offset renders both', () => {
  const qb = new QueryBuilder(new SQLiteDialect());
  const built = qb.generateSql(U as any, { select: ['id'], limit: 5, offset: 3 } as any);
  expect(built.query).toContain('LIMIT 5 OFFSET 3');
});


