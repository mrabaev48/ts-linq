import 'reflect-metadata';
import type { SchemaSnapshot } from '../src/migrations/DiffTypes';
import { compareSchemas } from '../src/migrations/DiffTypes';

describe('Schema diff core', () => {
  it('detects new table and added columns', () => {
    const expected: SchemaSnapshot = {
      tables: [
        {
          name: 'Users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
            { name: 'name', type: 'TEXT', nullable: false }
          ],
          primaryKeys: ['id'],
          indexes: [],
          foreignKeys: []
        }
      ]
    };
    const actual: SchemaSnapshot = { tables: [] };
    const diff = compareSchemas(expected, actual);
    expect(diff.tables.some((t) => (!!t.create && t.table === 'Users') || !!t.create)).toBeTruthy();
    const created = diff.tables.find((t) => t.create)!;
    expect(created.create!.name).toBe('Users');
  });
});
