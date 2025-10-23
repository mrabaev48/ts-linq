import { SchemaInspectionService } from '../../src/migrations/services/SchemaInspectionService';
import type { DatabaseProvider } from '../../src/DatabaseProvider';

vi.mock('../../src/migrations/SchemaInspector', () => {
  class BaseMock {
    listTables = vi.fn(async () => []);
    getTableSnapshot = vi.fn(async (_: string) => null);
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
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    beginTransaction: vi.fn(async () => {}),
    commitTransaction: vi.fn(async () => {}),
    rollbackTransaction: vi.fn(async () => {}),
    inTransactionState: false,
    getDialect: vi.fn(),
    executeQuery: vi.fn(),
    executeNonQuery: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn()
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
