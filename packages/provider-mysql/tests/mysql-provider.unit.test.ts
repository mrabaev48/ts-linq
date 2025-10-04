import { MySqlProvider } from '../src';
import { MetadataStorage } from '@ts-linq/core';

class E {
  id!: number;
  name!: string;
}

beforeEach(() => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(E, 'e');
  MetadataStorage.addColumn(E, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: true
  });
  MetadataStorage.addColumn(E, {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT',
    nullable: false
  });
  MetadataStorage.addPrimaryKey(E, 'id');
});

describe('MySqlProvider unit', () => {
  it('insert builds VALUES and executes', async () => {
    const p = new MySqlProvider('mysql://mock');
    (p as any).connect = jest.fn(async () => {
      (p as any).isConnected = true;
      (p as any).pool = {
        execute: jest.fn(async () => [{ affectedRows: 1 }]),
        query: jest.fn(async () => [{}]),
        end: jest.fn(async () => {})
      };
    });
    await p.insert({ name: 'a' }, E);
    expect((p as any).pool.execute).toHaveBeenCalled();
  });

  it('update increments version', async () => {
    MetadataStorage.addColumn(E, {
      propertyName: 'ver',
      columnName: 'ver',
      type: 'INTEGER',
      nullable: false,
      isVersion: true
    } as any);
    const ent: any = { id: 1, name: 'a', ver: 1 };
    const p = new MySqlProvider('mysql://mock');
    (p as any).connect = jest.fn(async () => {
      (p as any).isConnected = true;
      (p as any).pool = {
        execute: jest.fn(async () => [{ affectedRows: 1 }]),
        query: jest.fn(async () => [{}]),
        end: jest.fn(async () => {})
      };
    });
    await p.update(ent, E);
    expect(ent.ver).toBe(2);
  });
});
