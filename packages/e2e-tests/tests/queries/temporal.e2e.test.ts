/**
 * E2E tests for temporal queries — P2-36.
 *
 * Tests the full stack: Queryable → QueryBuilder → MssqlDialect → MssqlProvider.
 * Requires a running SQL Server 2016+ (MSSQL_URL env variable).
 * MSSQL-only: temporal queries are not supported by PostgreSQL / MySQL dialects.
 */

import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions } from '@ts-linq/types';
import { TemporalNotSupportedError } from '@ts-linq/types';

import { setupTestDatabase, teardownTestDatabase } from '../../src/setup';

const E2E_TABLE = 'e2e_temporal_employees';
const E2E_HISTORY = 'e2e_temporal_employees_history';

// ---------------------------------------------------------------------------
// Pure unit tests (no DB required)
// ---------------------------------------------------------------------------

describe('Temporal — pure unit (no DB)', () => {
  class SomeEntity {
    id!: number;
  }

  beforeEach(() => {
    MetadataStorage.reset();
    MetadataStorage.addEntity(SomeEntity, 'some_entity');
    MetadataStorage.addColumn(SomeEntity, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addPrimaryKey(SomeEntity, 'id');
  });

  describe('PostgresDialect temporal guard', () => {
    it('throws TemporalNotSupportedError for any temporal mode', () => {
      const dialect = new PostgresDialect();
      const modes: QueryOptions['temporal'][] = [
        { mode: 'AsOf', from: new Date() },
        { mode: 'All' },
        { mode: 'Between', from: new Date(), to: new Date() },
        { mode: 'FromTo', from: new Date(), to: new Date() },
        { mode: 'ContainedIn', from: new Date(), to: new Date() }
      ];
      for (const temporal of modes) {
        expect(() =>
          dialect.buildSelect(SomeEntity, { temporal }, MetadataStorage.getEntity(SomeEntity))
        ).toThrow(TemporalNotSupportedError);
      }
    });
  });

  describe('MysqlDialect temporal guard', () => {
    it('throws TemporalNotSupportedError for any temporal mode', () => {
      const dialect = new MysqlDialect();
      const modes: QueryOptions['temporal'][] = [
        { mode: 'AsOf', from: new Date() },
        { mode: 'All' },
        { mode: 'Between', from: new Date(), to: new Date() },
        { mode: 'FromTo', from: new Date(), to: new Date() },
        { mode: 'ContainedIn', from: new Date(), to: new Date() }
      ];
      for (const temporal of modes) {
        expect(() =>
          dialect.buildSelect(SomeEntity, { temporal }, MetadataStorage.getEntity(SomeEntity))
        ).toThrow(TemporalNotSupportedError);
      }
    });
  });

  describe('MssqlDialect SQL shapes', () => {
    it('AsOf generates correct SQL shape', () => {
      const dialect = new MssqlDialect();
      const { query } = dialect.buildSelect(
        SomeEntity,
        {
          temporal: { mode: 'AsOf', from: new Date('2023-01-01') }
        },
        MetadataStorage.getEntity(SomeEntity)
      );
      expect(query).toMatch(/FOR SYSTEM_TIME AS OF @p1/);
    });

    it('All generates correct SQL shape', () => {
      const dialect = new MssqlDialect();
      const { query } = dialect.buildSelect(
        SomeEntity,
        { temporal: { mode: 'All' } },
        MetadataStorage.getEntity(SomeEntity)
      );
      expect(query).toMatch(/FOR SYSTEM_TIME ALL/);
    });

    it('Between generates correct SQL shape', () => {
      const dialect = new MssqlDialect();
      const { query } = dialect.buildSelect(
        SomeEntity,
        {
          temporal: { mode: 'Between', from: new Date(), to: new Date() }
        },
        MetadataStorage.getEntity(SomeEntity)
      );
      expect(query).toMatch(/FOR SYSTEM_TIME BETWEEN @p1 AND @p2/);
    });

    it('FromTo generates correct SQL shape', () => {
      const dialect = new MssqlDialect();
      const { query } = dialect.buildSelect(
        SomeEntity,
        {
          temporal: { mode: 'FromTo', from: new Date(), to: new Date() }
        },
        MetadataStorage.getEntity(SomeEntity)
      );
      expect(query).toMatch(/FOR SYSTEM_TIME FROM @p1 TO @p2/);
    });

    it('ContainedIn generates correct SQL shape', () => {
      const dialect = new MssqlDialect();
      const { query } = dialect.buildSelect(
        SomeEntity,
        {
          temporal: { mode: 'ContainedIn', from: new Date(), to: new Date() }
        },
        MetadataStorage.getEntity(SomeEntity)
      );
      expect(query).toMatch(/FOR SYSTEM_TIME CONTAINED IN \(@p1, @p2\)/);
    });
  });
});

// ---------------------------------------------------------------------------
// E2E MSSQL tests (require MSSQL_URL)
// ---------------------------------------------------------------------------

const run = process.env.SKIP_DB_TESTS !== '1';
const mssqlUrl = process.env.MSSQL_URL;

(run && mssqlUrl ? describe : describe.skip)(
  'E2E Temporal Queries (MSSQL system-versioned table)',
  () => {
    let harness: any;

    let provider: any;

    class E2EEmployee {
      id!: number;
      name!: string;
      department!: string;
    }

    let insertTime: Date;

    beforeAll(async () => {
      ({ harness, provider } = await setupTestDatabase('mssql'));
      await provider.connect();

      // Clean previous run
      await provider.executeNonQuery(`
        IF OBJECT_ID('${E2E_TABLE}', 'U') IS NOT NULL
        BEGIN
          ALTER TABLE ${E2E_TABLE} SET (SYSTEM_VERSIONING = OFF);
          DROP TABLE IF EXISTS ${E2E_HISTORY};
          DROP TABLE ${E2E_TABLE};
        END
      `);

      // Create system-versioned table
      await provider.executeNonQuery(`
        CREATE TABLE ${E2E_TABLE} (
          id         INT IDENTITY(1,1) PRIMARY KEY,
          name       NVARCHAR(255)     NOT NULL,
          department NVARCHAR(255)     NOT NULL,
          SysStart   DATETIME2         GENERATED ALWAYS AS ROW START NOT NULL,
          SysEnd     DATETIME2         GENERATED ALWAYS AS ROW END   NOT NULL,
          PERIOD FOR SYSTEM_TIME (SysStart, SysEnd)
        )
        WITH (SYSTEM_VERSIONING = ON (
          HISTORY_TABLE = dbo.${E2E_HISTORY},
          DATA_CONSISTENCY_CHECK = ON
        ))
      `);

      await provider.executeNonQuery(
        `INSERT INTO ${E2E_TABLE} (name, department) VALUES (@p1, @p2)`,
        ['Alice', 'Engineering']
      );

      insertTime = new Date();

      await new Promise((r) => setTimeout(r, 600));

      await provider.executeNonQuery(`UPDATE ${E2E_TABLE} SET department = @p1 WHERE name = @p2`, [
        'Management',
        'Alice'
      ]);

      // Register metadata
      MetadataStorage.reset();
      MetadataStorage.addEntity(E2EEmployee, E2E_TABLE);
      MetadataStorage.addColumn(E2EEmployee, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: true
      });
      MetadataStorage.addColumn(E2EEmployee, {
        propertyName: 'name',
        columnName: 'name',
        type: 'NVARCHAR',
        nullable: false
      });
      MetadataStorage.addColumn(E2EEmployee, {
        propertyName: 'department',
        columnName: 'department',
        type: 'NVARCHAR',
        nullable: false
      });
      MetadataStorage.addPrimaryKey(E2EEmployee, 'id');
    });

    afterAll(async () => {
      try {
        await provider.executeNonQuery(`
          IF OBJECT_ID('${E2E_TABLE}', 'U') IS NOT NULL
          BEGIN
            ALTER TABLE ${E2E_TABLE} SET (SYSTEM_VERSIONING = OFF);
            DROP TABLE IF EXISTS ${E2E_HISTORY};
            DROP TABLE ${E2E_TABLE};
          END
        `);
      } catch {}
      await teardownTestDatabase(harness);
    });

    test('temporalAll: returns both current (Management) and historical (Engineering) rows', async () => {
      const dialect = new MssqlDialect();
      const { query, parameters } = dialect.buildSelect(
        E2EEmployee,
        { temporal: { mode: 'All' } },
        MetadataStorage.getEntity(E2EEmployee)
      );
      const rows = (await provider.executeQuery(query, parameters)) as Array<{
        department: string;
      }>;
      const depts = rows.map((r) => r.department);
      expect(depts).toContain('Engineering');
      expect(depts).toContain('Management');
    });

    test('temporalAsOf insertTime: returns Engineering (pre-update snapshot)', async () => {
      const dialect = new MssqlDialect();
      const { query, parameters } = dialect.buildSelect(
        E2EEmployee,
        {
          temporal: { mode: 'AsOf', from: insertTime }
        },
        MetadataStorage.getEntity(E2EEmployee)
      );
      const rows = (await provider.executeQuery(query, parameters)) as Array<{
        name: string;
        department: string;
      }>;
      const alice = rows.find((r) => r.name === 'Alice');
      expect(alice).toBeDefined();
      expect(alice?.department).toBe('Engineering');
    });

    test('temporalAsOf now: returns current row (Management)', async () => {
      const dialect = new MssqlDialect();
      const { query, parameters } = dialect.buildSelect(
        E2EEmployee,
        {
          temporal: { mode: 'AsOf', from: new Date() }
        },
        MetadataStorage.getEntity(E2EEmployee)
      );
      const rows = (await provider.executeQuery(query, parameters)) as Array<{
        name: string;
        department: string;
      }>;
      const alice = rows.find((r) => r.name === 'Alice');
      expect(alice?.department).toBe('Management');
    });
  }
);
