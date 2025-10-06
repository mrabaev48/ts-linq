import fc from 'fast-check';
import { MetadataStorage, type QueryOptions } from '@ts-linq/core';
import { MssqlDialect } from '../src';

class T {
  id!: number;
  a!: number;
  b!: string;
}

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

test('MSSQL: ? -> @pN в корректном порядке, selectParams первыми', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 5 }),
      fc.integer({ min: 0, max: 5 }),
      (selectCount, whereCount) => {
        const select = Array.from({ length: selectCount }, (_, i) => `CONCAT(b, ?) AS j${i}`);
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
        const built = new MssqlDialect().buildSelect(T as any, opts);
        const total = selectCount + whereCount;
        for (let i = 1; i <= total; i++) expect(built.query).toContain(`@p${i}`);
        expect(built.parameters).toEqual([...selectParams, ...where.map((w) => w.parameters[0])]);
      }
    ),
    { numRuns: 20 }
  );
});
