import { generateMigrationFromDiff } from '../../src/migrations/DialectMigrationSql';

test('Indexes: Postgres USING/CONCURRENTLY/WITH/WHERE', () => {
  const diff = {
    tables: [
      {
        table: 'Docs',
        indexCreates: [
          {
            name: 'idx_docs_body',
            columns: ['body'],
            using: 'gin',
            concurrently: true,
            withParams: { fastupdate: 'off' },
            where: 'body IS NOT NULL'
          }
        ]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(sql).toContain(
    'CREATE INDEX CONCURRENTLY "idx_docs_body" ON "Docs" USING GIN ("body") WITH (fastupdate=\'off\') WHERE body IS NOT NULL'
  );
});

test('Indexes: MSSQL INCLUDE', () => {
  const diff = {
    tables: [{ table: 'Docs', indexCreates: [{ name: 'i1', columns: ['a'], include: ['b', 'c'] }] }]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'mssql').up.join('\n');
  expect(sql).toContain('CREATE INDEX [i1] ON [Docs] ([a]) INCLUDE ([b], [c])');
});

test('Indexes: MySQL visibility', () => {
  const diff = {
    tables: [
      {
        table: 'Docs',
        indexCreates: [{ name: 'i2', columns: ['a'], mysqlVisibility: 'INVISIBLE' }]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'mysql').up.join('\n');
  expect(sql).toContain('CREATE INDEX `i2` ON `Docs` (`a`) INVISIBLE');
});

test('Indexes: Postgres combined options (orders/collations/nulls/expr/with/where)', () => {
  const diff = {
    tables: [
      {
        table: 'T',
        indexCreates: [
          {
            name: 'ix_all',
            columns: ['a', 'b'],
            orders: { b: 'DESC' },
            collations: { a: 'en_US' },
            nulls: { b: 'LAST' },
            expressions: ['lower(a)'],
            using: 'btree',
            withParams: { fillfactor: 80 },
            where: 'b IS NOT NULL'
          }
        ]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(sql).toContain(
    'CREATE INDEX "ix_all" ON "T" USING BTREE ("a" COLLATE en_US, "b" DESC NULLS LAST, (lower(a))) WITH (fillfactor=80) WHERE b IS NOT NULL'
  );
});

test('Indexes: MSSQL orders + INCLUDE + WHERE', () => {
  const diff = {
    tables: [
      {
        table: 'T',
        indexCreates: [
          {
            name: 'ix2',
            columns: ['a'],
            orders: { a: 'DESC' },
            include: ['c', 'd'],
            where: 'a > 0'
          }
        ]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'mssql').up.join('\n');
  expect(sql).toContain('CREATE INDEX [ix2] ON [T] ([a] DESC) INCLUDE ([c], [d]) WHERE a > 0');
});

test('Indexes: SQLite COLLATE is rendered', () => {
  const diff = {
    tables: [
      {
        table: 'T',
        indexCreates: [{ name: 'ix3', columns: ['title'], collations: { title: 'NOCASE' } }]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'sqlite').up.join('\n');
  expect(sql).toContain('CREATE INDEX ix3 ON T (title COLLATE NOCASE)');
});
