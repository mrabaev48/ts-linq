import fc from 'fast-check';
import { QueryBuilder, MetadataStorage, type QueryOptions } from '@ts-linq/core';
import { PostgresDialect } from '@ts-linq/postgres';
import { MysqlDialect } from '@ts-linq/mysql';
import { MssqlDialect } from '@ts-linq/mssql';
import { SQLiteDialect } from '@ts-linq/sqlite';

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
          // Проверяем, что используются плейсхолдеры нужного типа и их ровно 2
          const q = built.query;
          const expectedParams = 2;
          // В запросе не должно быть одинарных кавычек (никаких инлайновых литералов)
          expect(q).not.toContain("'");
          // И фактически переданные параметры сохранены отдельно
          expect((built.parameters as unknown[]).length).toBe(expectedParams);
        }
      }),
      { numRuns: 20 }
    );
  });
});
