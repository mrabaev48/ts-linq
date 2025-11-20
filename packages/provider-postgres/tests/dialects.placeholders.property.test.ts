import fc from 'fast-check';
import { QueryBuilder } from '@ts-linq/query';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions } from '@ts-linq/types';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { SQLiteDialect } from '@ts-linq/dialect-sqlite';

class T {
  id!: number;
  a!: number;
  b!: string;
}

describe('Dialect placeholders (property-based)', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(T, 't');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'a',
      columnName: 'a',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'b',
      columnName: 'b',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(T, 'id');
  });

  const arbCounts = fc.integer({ min: 0, max: 5 });

  test('Postgres: ? -> $n in correct order; selectParams first', () => {
    fc.assert(
      fc.property(arbCounts, arbCounts, (selectCount, whereCount) => {
        const dialect = new PostgresDialect();
        const select = Array.from(
          { length: selectCount },
          (_, i) => `jsonb_path_query_first(b, ?) AS j${i}`
        );
        const selectParams = Array.from({ length: selectCount }, (_, i) => `p${i}`);
        const where = Array.from({ length: whereCount }, (_, i) => ({
          condition: `a > ?`,
          parameters: [i]
        }));
        const opts: QueryOptions = {
          select: selectCount ? select : ['id'],
          selectParams,
          where
        } as any;
        const built = dialect.buildSelect(T as any, opts);
        const total = selectCount + whereCount;
        for (let i = 1; i <= total; i++) {
          expect(built.query).toContain(`$${i}`);
        }
        expect(built.parameters).toEqual([...selectParams, ...where.map((w) => w.parameters[0])]);
      }),
      { numRuns: 20 }
    );
  });

  test('MySQL: ? preserved; count matches parameters', () => {
    fc.assert(
      fc.property(arbCounts, arbCounts, (selectCount, whereCount) => {
        const dialect = new MysqlDialect();
        const select = Array.from({ length: selectCount }, () => `JSON_EXTRACT(b, ?) AS j`);
        const selectParams = Array.from({ length: selectCount }, (_, i) => `p${i}`);
        const where = Array.from({ length: whereCount }, () => ({
          condition: `a > ?`,
          parameters: [1]
        }));
        const built = dialect.buildSelect(
          T as any,
          { select: selectCount ? select : ['id'], selectParams, where } as any
        );
        const total = selectCount + whereCount;
        const qCount = (built.query.match(/\?/g) || []).length;
        expect(qCount).toBe(total);
        expect(built.parameters.length).toBe(total);
      }),
      { numRuns: 20 }
    );
  });

  test('MSSQL: ? -> @pN in order', () => {
    fc.assert(
      fc.property(arbCounts, arbCounts, (selectCount, whereCount) => {
        const dialect = new MssqlDialect();
        const select = Array.from({ length: selectCount }, () => `CONCAT(b, ?) AS x`);
        const selectParams = Array.from({ length: selectCount }, (_, i) => `p${i}`);
        const where = Array.from({ length: whereCount }, (_, i) => ({
          condition: `a = ?`,
          parameters: [i]
        }));
        const built = dialect.buildSelect(
          T as any,
          { select: selectCount ? select : ['id'], selectParams, where } as any
        );
        const total = selectCount + whereCount;
        for (let i = 1; i <= total; i++) {
          expect(built.query).toContain(`@p${i}`);
        }
        expect(built.parameters).toEqual([...selectParams, ...where.map((w) => w.parameters[0])]);
      }),
      { numRuns: 20 }
    );
  });

  test('SQLite: ? preserved; OFFSET without LIMIT inserts LIMIT -1', () => {
    const qb = new QueryBuilder(new SQLiteDialect());
    const built = qb.generateSql(
      T as any,
      {
        select: ['id'],
        where: [{ condition: 'a > ?', parameters: [1] }],
        offset: 10
      } as any
    );
    expect(built.query).toContain('LIMIT -1 OFFSET 10');
    expect((built.query.match(/\?/g) || []).length).toBe(1);
  });
});
