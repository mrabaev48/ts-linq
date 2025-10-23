import fc from 'fast-check';
import { MetadataStorage, QueryBuilder, type QueryOptions } from '@ts-linq/core';
import { PostgresDialect } from '@ts-linq/provider-postgres';
import { MysqlDialect } from '@ts-linq/provider-mysql';
import { MssqlDialect } from '@ts-linq/provider-mssql';
import { SQLiteDialect } from '@ts-linq/provider-sqlite';

class U {
  id!: number;
  name!: string;
  region!: string;
  amount!: number;
}

describe('JOIN / GROUP BY / HAVING / ORDER (property-based)', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(U, 'u');
    MetadataStorage.addColumn(U, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(U, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(U, {
      propertyName: 'region',
      columnName: 'region',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(U, {
      propertyName: 'amount',
      columnName: 'amount',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(U, 'id');
  });

  const dialects = [
    { name: 'pg', qb: () => new QueryBuilder(new PostgresDialect()), qid: (s: string) => `"${s}"` },
    {
      name: 'mysql',
      qb: () => new QueryBuilder(new MysqlDialect()),
      qid: (s: string) => `\`${s}\``
    },
    { name: 'mssql', qb: () => new QueryBuilder(new MssqlDialect()), qid: (s: string) => `[${s}]` },
    { name: 'sqlite', qb: () => new QueryBuilder(new SQLiteDialect()), qid: (s: string) => s }
  ] as const;

  test.each(dialects)('%s: renders JOIN/GROUP BY/HAVING/ORDER consistently', ({ qb, qid }) => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (withJoin, withHaving, withOrder) => {
        const builder = qb();
        const joins = withJoin
          ? [
              {
                type: 'LEFT',
                table: 'orders',
                alias: 'o',
                on: `${qid('o')}.${qid('user_id')} = ${qid('u')}.${qid('id')}`
              }
            ]
          : [];
        const groupBy = {
          columns: ['region'] as string[],
          having: withHaving ? { condition: 'COUNT(*) > ?', parameters: [1] } : undefined
        } as any;
        const orderBy = withOrder ? [{ column: 'region', direction: 'ASC' }] : [];
        const opts: QueryOptions = {
          select: ['region', 'COUNT(*) AS cnt'],
          from: 'u',
          joins,
          groupBy,
          orderBy
        } as any;
        const built = builder.generateSql(U as any, opts);
        expect(built.query).toContain('SELECT');
        expect(built.query).toContain('FROM');
        if (withJoin) expect(built.query).toContain('JOIN');
        expect(built.query).toContain('GROUP BY');
        if (withHaving) expect(built.query).toContain('HAVING');
        if (withOrder) expect(built.query).toContain('ORDER BY');
        if (withHaving) expect(built.parameters).toEqual([1]);
        else expect(built.parameters.length).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 20 }
    );
  });
});
