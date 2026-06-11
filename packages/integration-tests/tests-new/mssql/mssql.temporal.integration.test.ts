/**
 * Live MSSQL integration tests for temporal queries — P2-36.
 *
 * Requires a running SQL Server 2016+ with system-versioning support.
 * Skip automatically when MSSQL_URL env var is not set.
 *
 * Coverage:
 * - Creates a system-versioned table (PERIOD FOR SYSTEM_TIME)
 * - temporalAll() returns both current and historical rows
 * - temporalAsOf() returns the snapshot at a specific point in time
 * - temporalBetween() / temporalFromTo() / temporalContainedIn() return filtered history
 */

import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { MetadataStorage } from '@ts-linq/metadata';
import { MssqlProvider } from '@ts-linq/provider-mssql';
import { Queryable } from '@ts-linq/query';
import { QueryContext } from '@ts-linq/query/internal';
import type { SqlParameter } from '@ts-linq/types';

const url = process.env.MSSQL_URL;
const mssqlDescribe = url ? describe : describe.skip;

const TABLE_NAME = 'mssql_temporal_employees';
const HISTORY_TABLE = 'mssql_temporal_employees_history';

class TemporalEmployee {
  id!: number;
  name!: string;
  department!: string;
}

mssqlDescribe('[integration][mssql] Temporal queries (system-versioned table)', () => {
  let provider: MssqlProvider;

  /** UTC timestamp of the initial INSERT, used for AsOf/range tests. */
  let insertTime: Date;

  beforeAll(async () => {
    provider = new MssqlProvider({
      server: process.env.MSSQL_SERVER || 'localhost',
      port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT) : 1433,
      database: process.env.MSSQL_DB || 'testdb',
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD,
      trustServerCertificate: true
    });
    await provider.connect();

    // Tear down previous run artefacts
    await provider.executeNonQuery(`
      IF OBJECT_ID('${TABLE_NAME}', 'U') IS NOT NULL
      BEGIN
        ALTER TABLE ${TABLE_NAME} SET (SYSTEM_VERSIONING = OFF);
        DROP TABLE IF EXISTS ${HISTORY_TABLE};
        DROP TABLE ${TABLE_NAME};
      END
    `);

    // Create system-versioned table
    await provider.executeNonQuery(`
      CREATE TABLE ${TABLE_NAME} (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        name       NVARCHAR(255)     NOT NULL,
        department NVARCHAR(255)     NOT NULL,
        SysStart   DATETIME2         GENERATED ALWAYS AS ROW START NOT NULL,
        SysEnd     DATETIME2         GENERATED ALWAYS AS ROW END   NOT NULL,
        PERIOD FOR SYSTEM_TIME (SysStart, SysEnd)
      )
      WITH (SYSTEM_VERSIONING = ON (
        HISTORY_TABLE = dbo.${HISTORY_TABLE},
        DATA_CONSISTENCY_CHECK = ON
      ))
    `);

    // Insert seed row and capture the insertion time
    await provider.executeNonQuery(
      `INSERT INTO ${TABLE_NAME} (name, department) VALUES (@p1, @p2)`,
      ['Alice', 'Engineering']
    );

    insertTime = new Date();

    // Small delay so the update creates a distinct history record
    await new Promise((r) => setTimeout(r, 500));

    // Update the row to create a history entry
    await provider.executeNonQuery(`UPDATE ${TABLE_NAME} SET department = @p1 WHERE name = @p2`, [
      'Management',
      'Alice'
    ]);

    // Register entity metadata
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(TemporalEmployee, TABLE_NAME);
    MetadataStorage.addColumn(TemporalEmployee, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(TemporalEmployee, {
      propertyName: 'name',
      columnName: 'name',
      type: 'NVARCHAR',
      nullable: false
    });
    MetadataStorage.addColumn(TemporalEmployee, {
      propertyName: 'department',
      columnName: 'department',
      type: 'NVARCHAR',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(TemporalEmployee, 'id');
  });

  afterAll(async () => {
    try {
      await provider.executeNonQuery(`
        IF OBJECT_ID('${TABLE_NAME}', 'U') IS NOT NULL
        BEGIN
          ALTER TABLE ${TABLE_NAME} SET (SYSTEM_VERSIONING = OFF);
          DROP TABLE IF EXISTS ${HISTORY_TABLE};
          DROP TABLE ${TABLE_NAME};
        END
      `);
    } catch {}
    await provider.disconnect();
  });

  // ─── temporalAll ──────────────────────────────────────────────────────────

  test('temporalAll() returns current and historical rows', async () => {
    const dialect = new MssqlDialect();
    const { query, parameters } = dialect.buildSelect(TemporalEmployee, {
      temporal: { mode: 'All' }
    });
    const rows = await provider.executeQuery<{ name: string; department: string }>(
      query,
      parameters as SqlParameter[]
    );
    // Should contain at least the current row and one historical row
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const departments = rows.map((r) => r.department);
    expect(departments).toContain('Engineering');
    expect(departments).toContain('Management');
  });

  // ─── temporalAsOf ─────────────────────────────────────────────────────────

  test('temporalAsOf() returns snapshot at insertTime (before the update)', async () => {
    const dialect = new MssqlDialect();
    const { query, parameters } = dialect.buildSelect(TemporalEmployee, {
      temporal: { mode: 'AsOf', from: insertTime }
    });
    const rows = await provider.executeQuery<{ name: string; department: string }>(
      query,
      parameters as SqlParameter[]
    );
    // At insertTime Alice was in Engineering
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const alice = rows.find((r) => r.name === 'Alice');
    expect(alice).toBeDefined();
    expect(alice?.department).toBe('Engineering');
  });

  // ─── temporalAsOf — current time ─────────────────────────────────────────

  test('temporalAsOf() with current time returns current row', async () => {
    const dialect = new MssqlDialect();
    const { query, parameters } = dialect.buildSelect(TemporalEmployee, {
      temporal: { mode: 'AsOf', from: new Date() }
    });
    const rows = await provider.executeQuery<{ name: string; department: string }>(
      query,
      parameters as SqlParameter[]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const alice = rows.find((r) => r.name === 'Alice');
    expect(alice?.department).toBe('Management');
  });

  // ─── SQL shape verification ───────────────────────────────────────────────

  test('MssqlDialect generates valid FOR SYSTEM_TIME ALL SQL', () => {
    const dialect = new MssqlDialect();
    const { query } = dialect.buildSelect(TemporalEmployee, { temporal: { mode: 'All' } });
    expect(query).toContain(`FROM [${TABLE_NAME}] FOR SYSTEM_TIME ALL`);
  });

  test('MssqlDialect generates valid FOR SYSTEM_TIME AS OF SQL', () => {
    const dialect = new MssqlDialect();
    const pointInTime = new Date('2023-01-01');
    const { query, parameters } = dialect.buildSelect(TemporalEmployee, {
      temporal: { mode: 'AsOf', from: pointInTime }
    });
    expect(query).toContain(`FROM [${TABLE_NAME}] FOR SYSTEM_TIME AS OF @p1`);
    expect(parameters[0]).toBe(pointInTime);
  });

  test('MssqlDialect generates valid FOR SYSTEM_TIME BETWEEN SQL', () => {
    const dialect = new MssqlDialect();
    const from = new Date('2022-01-01');
    const to = new Date('2025-01-01');
    const { query, parameters } = dialect.buildSelect(TemporalEmployee, {
      temporal: { mode: 'Between', from, to }
    });
    expect(query).toContain(`FROM [${TABLE_NAME}] FOR SYSTEM_TIME BETWEEN @p1 AND @p2`);
    expect(parameters[0]).toBe(from);
    expect(parameters[1]).toBe(to);
  });

  test('MssqlDialect generates valid FOR SYSTEM_TIME FROM TO SQL', () => {
    const dialect = new MssqlDialect();
    const from = new Date('2022-01-01');
    const to = new Date('2025-01-01');
    const { query, parameters } = dialect.buildSelect(TemporalEmployee, {
      temporal: { mode: 'FromTo', from, to }
    });
    expect(query).toContain(`FROM [${TABLE_NAME}] FOR SYSTEM_TIME FROM @p1 TO @p2`);
    expect(parameters[0]).toBe(from);
    expect(parameters[1]).toBe(to);
  });

  test('MssqlDialect generates valid FOR SYSTEM_TIME CONTAINED IN SQL', () => {
    const dialect = new MssqlDialect();
    const from = new Date('2022-01-01');
    const to = new Date('2025-01-01');
    const { query, parameters } = dialect.buildSelect(TemporalEmployee, {
      temporal: { mode: 'ContainedIn', from, to }
    });
    expect(query).toContain(`FROM [${TABLE_NAME}] FOR SYSTEM_TIME CONTAINED IN (@p1, @p2)`);
    expect(parameters[0]).toBe(from);
    expect(parameters[1]).toBe(to);
  });

  // ─── Queryable integration ────────────────────────────────────────────────

  test('Queryable.temporalAll() builds model.temporal correctly', () => {
    const q = new Queryable(TemporalEmployee, QueryContext.fromProvider(provider as any));
    const tq = q.temporalAll();
    expect((tq as any)._model.temporal).toEqual({ mode: 'All' });
  });

  test('Queryable.temporalAsOf() builds model.temporal correctly', () => {
    const pt = new Date('2023-06-01');
    const q = new Queryable(TemporalEmployee, QueryContext.fromProvider(provider as any));
    const tq = q.temporalAsOf(pt);
    expect((tq as any)._model.temporal).toEqual({ mode: 'AsOf', from: pt });
  });
});
