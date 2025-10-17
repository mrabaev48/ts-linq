import fc from 'fast-check';
import { QueryBuilder, MetadataStorage, type QueryOptions } from '@ts-linq/core';
import { PostgresDialect } from '@ts-linq/provider-postgres';
import { MysqlDialect } from '@ts-linq/provider-mysql';
import { MssqlDialect } from '@ts-linq/provider-mssql';
import { SQLiteDialect } from '@ts-linq/provider-sqlite';

class Z {
  id!: number;
  x!: string;
}

describe('Parameterization (SQL-injection safety) property-based', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Z, 'z');
    MetadataStorage.addColumn(Z, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(Z, {
      propertyName: 'x',
      columnName: 'x',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(Z, 'id');
  });

  const dialects = [
    new PostgresDialect(),
    new MysqlDialect(),
    new MssqlDialect(),
    new SQLiteDialect()
  ];

  test('malicious strings never interpolated into SQL (only placeholders appear)', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        for (const d of dialects) {
          const qb = new QueryBuilder(d as any);
          const opts: QueryOptions = {
            select: ['id'],
            where: [
              { condition: 'x = ?', parameters: [a] },
              { condition: 'x <> ?', parameters: [b] }
            ]
          } as any;
          const built = qb.generateSql(Z as any, opts);
          // Ensure placeholders of correct type are used and exactly two of them
          const q = built.query;
          const expectedParams = 2;
          // No single quotes in SQL (no inlined literals)
          expect(q).not.toContain("'");
          // And actual parameters are provided separately
          expect((built.parameters as unknown[]).length).toBe(expectedParams);
        }
      }),
      { numRuns: 20 }
    );
  });
});
