import { compareSchemas, type SchemaSnapshot } from '../src/migrations/DiffTypes';

describe('Diff generator: constraint rename detection', () => {
  test('detects UNIQUE rename by same columns', () => {
    const expected: SchemaSnapshot = {
      tables: [
        {
          name: 'T',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'TEXT', nullable: false }
          ],
          primaryKeys: ['id'],
          indexes: [],
          foreignKeys: [],
          uniqueConstraints: [{ name: 'UQ_T_name_new', columns: ['name'] }],
          checkConstraints: []
        }
      ]
    };
    const actual: SchemaSnapshot = {
      tables: [
        {
          name: 'T',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'TEXT', nullable: false }
          ],
          primaryKeys: ['id'],
          indexes: [],
          foreignKeys: [],
          uniqueConstraints: [{ name: 'UQ_T_name_old', columns: ['name'] }],
          checkConstraints: []
        }
      ]
    };
    const diff = compareSchemas(expected, actual);
    const t = diff.tables.find((d) => d.table === 'T');
    expect(t?.uniqueRenames).toEqual([{ from: 'UQ_T_name_old', to: 'UQ_T_name_new' }]);
    expect(t?.uniqueCreates).toBeUndefined();
    expect(t?.uniqueDrops).toBeUndefined();
  });

  test('detects CHECK rename by same expression', () => {
    const expected: SchemaSnapshot = {
      tables: [
        {
          name: 'T',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'TEXT', nullable: false }
          ],
          primaryKeys: ['id'],
          indexes: [],
          foreignKeys: [],
          uniqueConstraints: [],
          checkConstraints: [{ name: 'CK_len_new', expression: 'length(name) > 0' }]
        }
      ]
    };
    const actual: SchemaSnapshot = {
      tables: [
        {
          name: 'T',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'TEXT', nullable: false }
          ],
          primaryKeys: ['id'],
          indexes: [],
          foreignKeys: [],
          uniqueConstraints: [],
          checkConstraints: [{ name: 'CK_len_old', expression: 'length(name) > 0' }]
        }
      ]
    };
    const diff = compareSchemas(expected, actual);
    const t = diff.tables.find((d) => d.table === 'T');
    expect(t?.checkRenames).toEqual([{ from: 'CK_len_old', to: 'CK_len_new' }]);
    expect(t?.checkCreates).toBeUndefined();
    expect(t?.checkDrops).toBeUndefined();
  });
});


