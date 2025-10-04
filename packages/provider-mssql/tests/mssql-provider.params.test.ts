import { MssqlProvider } from '../src';
import { MetadataStorage, type ColumnMetadata, type EntityMetadata } from '@ts-linq/core';

class E { id!: number; a!: number; b!: string }

beforeEach(() => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(E, 'e');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
    { propertyName: 'a', columnName: 'a', type: 'INTEGER', nullable: false },
    { propertyName: 'b', columnName: 'b', type: 'TEXT', nullable: false }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(E, c));
  MetadataStorage.addPrimaryKey(E, 'id');
});

test('parameter mapping ? -> @pN on executeNonQuery', async () => {
  const p = new MssqlProvider('mssql://user:pass@localhost/db');
  // @ts-expect-error avoid real connect
  p.isConnected = true;
  const records: any[] = [];
  // @ts-expect-error
  p['getRequest'] = () => ({ input: (_n: string, _v: unknown) => ({ input: () => ({}) }), query: async (sql: string) => { records.push(sql); return { rowsAffected: [1] }; } });
  await p.executeNonQuery('UPDATE t SET a=? WHERE id=?', [10, 1]);
  expect(records[0]).toContain('@p1');
  expect(records[0]).toContain('@p2');
});


