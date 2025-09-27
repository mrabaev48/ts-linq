import fc from 'fast-check';
import { MetadataStorage, type QueryOptions } from '@ts-linq/core';
import { PostgresDialect } from '@ts-linq/postgres';

class S { id!: number; v!: number }

describe('[pg] CTE/property-based', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(S, 'src');
    MetadataStorage.addColumn(S, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true });
    MetadataStorage.addColumn(S, { propertyName: 'v', columnName: 'v', type: 'INTEGER', nullable: false });
    MetadataStorage.addPrimaryKey(S, 'id');
  });

  test('CTE appears before SELECT and parameters numbered after selectParams', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }), (sp, wp) => {
        const dialect = new PostgresDialect();
        const select = Array.from({ length: sp }, () => 'jsonb_path_query_first(v, ?) AS j');
        const selectParams = Array.from({ length: sp }, (_, i) => `p${i}`);
        const where = Array.from({ length: wp }, (_, i) => ({ condition: 'v > ?', parameters: [i] }));
        const opts: QueryOptions = {
          select: select.length ? select : ['v'],
          selectParams,
          cte: { name: 't', sql: 'SELECT * FROM "src" WHERE v > 0' },
          from: 't',
          where
        } as any;
        const built = dialect.buildSelect(S as any, opts);
        expect(built.query.startsWith('WITH t AS (')).toBe(true);
        const total = sp + wp;
        if (total > 0) {
          for (let i = 1; i <= total; i++) expect(built.query).toContain(`$${i}`);
        }
      }),
      { numRuns: 20 }
    );
  });
});


