import { SchemaInspectionService } from '../../src/migrations/services/SchemaInspectionService';
import type { DatabaseProvider } from '../../src/DatabaseProvider';

jest.mock('../../src/migrations/SchemaInspector', () => {
  class BaseMock {
    listTables = jest.fn(async () => []);
    getTableSnapshot = jest.fn(async (_: string) => null);
  }
  return {
    SQLiteSchemaInspector: BaseMock,
    PostgresSchemaInspector: BaseMock,
    MySqlSchemaInspector: BaseMock,
    MssqlSchemaInspector: BaseMock
  };
});

function provider(
  label: 'sqlite' | 'postgresql' | 'mysql' | 'mssql'
): jest.Mocked<DatabaseProvider> {
  return {
    providerLabel: label,
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    beginTransaction: jest.fn(async () => {}),
    commitTransaction: jest.fn(async () => {}),
    rollbackTransaction: jest.fn(async () => {}),
    inTransactionState: false,
    getDialect: jest.fn(),
    executeQuery: jest.fn(),
    executeNonQuery: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn()
  } as unknown as jest.Mocked<DatabaseProvider>;
}

describe('SchemaInspectionService', () => {
  test.each([['sqlite'], ['postgresql'], ['mysql'], ['mssql']] as const)(
    'buildActualSnapshot works for %s',
    async (label) => {
      const svc = new SchemaInspectionService();
      const expected = { tables: [] } as any;
      const actual = await svc.buildActualSnapshot(provider(label), expected);
      expect(actual).toBeDefined();
      expect(Array.isArray(actual.tables)).toBe(true);
    }
  );
});
