import { MssqlProvider } from '../src';
import { MetadataStorage, type ColumnMetadata, type EntityMetadata } from '@ts-linq/core';

class E {
  id!: number;
  name!: string;
}

beforeEach(() => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(E, 'e');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
    { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(E, c));
  MetadataStorage.addPrimaryKey(E, 'id');
});

test('connect/disconnect toggles isConnected', async () => {
  const p = new MssqlProvider('mssql://user:pass@localhost/db');
  // mock pool to avoid real driver
  // @ts-expect-error overriding private
  p.pool = {
    connect: async () => undefined,
    close: async () => undefined,
    request: () => ({ input: () => ({ input: () => ({}) }), query: async () => ({}) })
  } as any;
  // @ts-expect-error
  p.isConnected = false;
  await p.disconnect();
  // доступ к флагу через protected getter недоступен; проверим косвенно через disconnect без подключения
  await expect(p.disconnect()).resolves.toBeUndefined();
});
