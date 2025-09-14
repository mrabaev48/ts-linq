import { PostgresSchemaInspector, MysqlSchemaInspector, MssqlSchemaInspector } from '../src/migrations/SchemaInspector';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Schema Inspectors (PG/MySQL/MSSQL)', () => {
  test('Postgres: listTables and getTableInfo', async () => {
    const calls: string[] = [];
    const provider = {
      executeQuery: async <T>(sql: string): Promise<T[]> => {
        calls.push(sql);
        if (sql.includes('information_schema.tables')) {
          return [{ table_name: 'users' }] as unknown as T[];
        }
        if (sql.includes('information_schema.columns')) {
          return [
            { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
            { column_name: 'name', data_type: 'text', is_nullable: 'YES', column_default: null }
          ] as unknown as T[];
        }
        if (sql.includes('PRIMARY KEY')) {
          return [{ column_name: 'id' }] as unknown as T[];
        }
        return [] as unknown as T[];
      }
    } as unknown as DatabaseProvider;
    const ins = new PostgresSchemaInspector(provider);
    expect(await ins.listTables()).toEqual(['users']);
    const info = await ins.getTableInfo('users');
    expect(info.name).toBe('users');
    expect(info.columns.find((c) => c.name === 'id')?.pk).toBeGreaterThan(0);
    expect(info.columns.find((c) => c.name === 'name')?.notnull).toBe(false);
  });

  test('MySQL: listTables and getTableInfo', async () => {
    const provider = {
      executeQuery: async <T>(sql: string): Promise<T[]> => {
        if (sql.includes('information_schema.tables')) {
          return [{ table_name: 'items' }] as unknown as T[];
        }
        if (sql.includes('information_schema.columns')) {
          return [
            { column_name: 'id', data_type: 'int', is_nullable: 'NO', column_default: null },
            { column_name: 'title', data_type: 'varchar', is_nullable: 'NO', column_default: '' }
          ] as unknown as T[];
        }
        if (sql.includes('constraint_name=\'PRIMARY\'')) {
          return [{ column_name: 'id' }] as unknown as T[];
        }
        return [] as unknown as T[];
      }
    } as unknown as DatabaseProvider;
    const ins = new MysqlSchemaInspector(provider);
    expect(await ins.listTables()).toEqual(['items']);
    const info = await ins.getTableInfo('items');
    expect(info.columns.find((c) => c.name === 'id')?.pk).toBeGreaterThan(0);
    expect(info.columns.find((c) => c.name === 'title')?.notnull).toBe(true);
  });

  test('MSSQL: listTables and getTableInfo', async () => {
    const provider = {
      executeQuery: async <T>(sql: string): Promise<T[]> => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) {
          return [{ TABLE_NAME: 'orders' }] as unknown as T[];
        }
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
          return [
            { COLUMN_NAME: 'id', DATA_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null },
            { COLUMN_NAME: 'amount', DATA_TYPE: 'decimal', IS_NULLABLE: 'YES', COLUMN_DEFAULT: null }
          ] as unknown as T[];
        }
        if (sql.includes("CONSTRAINT_TYPE='PRIMARY KEY'")) {
          return [{ COLUMN_NAME: 'id' }] as unknown as T[];
        }
        return [] as unknown as T[];
      }
    } as unknown as DatabaseProvider;
    const ins = new MssqlSchemaInspector(provider);
    expect(await ins.listTables()).toEqual(['orders']);
    const info = await ins.getTableInfo('orders');
    expect(info.columns.find((c) => c.name === 'amount')?.notnull).toBe(false);
  });
});


