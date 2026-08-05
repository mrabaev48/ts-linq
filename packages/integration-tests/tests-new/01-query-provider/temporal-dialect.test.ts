/**
 * Temporal dialect tests — P2-36.
 *
 * Tests SQL emission for all five EF Core temporal operators without a live DB.
 * Coverage:
 * - MssqlDialect emits correct FOR SYSTEM_TIME clauses
 * - Parameters are numbered @p1..@pN correctly
 * - PostgresDialect throws TemporalNotSupportedError
 * - MySqlDialect throws TemporalNotSupportedError
 * - buildTemporalClause throws TypeError when required dates are missing
 */

import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { buildTemporalClause } from '@ts-linq/dialect-mssql';
import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions, SqlParameter } from '@ts-linq/types';
import { TemporalNotSupportedError } from '@ts-linq/types';

// ---------------------------------------------------------------------------
// Entity fixture
// ---------------------------------------------------------------------------

class Employee {
  id!: number;
  name!: string;
  department!: string;
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function setupMetadata(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(Employee, 'employees');
  MetadataStorage.addColumn(Employee, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: true
  });
  MetadataStorage.addColumn(Employee, {
    propertyName: 'name',
    columnName: 'name',
    type: 'NVARCHAR',
    nullable: false
  });
  MetadataStorage.addColumn(Employee, {
    propertyName: 'department',
    columnName: 'department',
    type: 'NVARCHAR',
    nullable: false
  });
  MetadataStorage.addPrimaryKey(Employee, 'id');
}

// ---------------------------------------------------------------------------
// MSSQL — buildTemporalClause unit tests
// ---------------------------------------------------------------------------

describe('buildTemporalClause', () => {
  it('AsOf: appends date param and returns correct fragment', () => {
    const params: SqlParameter[] = [];
    const dt = new Date('2023-06-15T00:00:00Z');
    const fragment = buildTemporalClause({ mode: 'AsOf', from: dt }, params);
    expect(fragment).toBe(' FOR SYSTEM_TIME AS OF ?');
    expect(params).toEqual([dt]);
  });

  it('All: returns fragment without params', () => {
    const params: SqlParameter[] = [];
    const fragment = buildTemporalClause({ mode: 'All' }, params);
    expect(fragment).toBe(' FOR SYSTEM_TIME ALL');
    expect(params).toHaveLength(0);
  });

  it('Between: appends from and to params', () => {
    const params: SqlParameter[] = [];
    const from = new Date('2022-01-01');
    const to = new Date('2023-01-01');
    const fragment = buildTemporalClause({ mode: 'Between', from, to }, params);
    expect(fragment).toBe(' FOR SYSTEM_TIME BETWEEN ? AND ?');
    expect(params).toEqual([from, to]);
  });

  it('FromTo: appends from and to params', () => {
    const params: SqlParameter[] = [];
    const from = new Date('2022-01-01');
    const to = new Date('2023-01-01');
    const fragment = buildTemporalClause({ mode: 'FromTo', from, to }, params);
    expect(fragment).toBe(' FOR SYSTEM_TIME FROM ? TO ?');
    expect(params).toEqual([from, to]);
  });

  it('ContainedIn: appends from and to params', () => {
    const params: SqlParameter[] = [];
    const from = new Date('2022-01-01');
    const to = new Date('2023-01-01');
    const fragment = buildTemporalClause({ mode: 'ContainedIn', from, to }, params);
    expect(fragment).toBe(' FOR SYSTEM_TIME CONTAINED IN (?, ?)');
    expect(params).toEqual([from, to]);
  });

  it('AsOf: throws TypeError when from is missing', () => {
    expect(() => buildTemporalClause({ mode: 'AsOf' }, [])).toThrow(TypeError);
  });

  it('Between: throws TypeError when from is missing', () => {
    expect(() => buildTemporalClause({ mode: 'Between', to: new Date() }, [])).toThrow(TypeError);
  });

  it('Between: throws TypeError when to is missing', () => {
    expect(() => buildTemporalClause({ mode: 'Between', from: new Date() }, [])).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// MSSQL dialect — full SQL emission
// ---------------------------------------------------------------------------

describe('MssqlDialect temporal SQL emission', () => {
  let dialect: MssqlDialect;

  beforeEach(() => {
    dialect = new MssqlDialect();
    setupMetadata();
  });

  it('temporalAsOf: emits FOR SYSTEM_TIME AS OF @p1 after FROM', () => {
    const pointInTime = new Date('2023-01-01T00:00:00Z');
    const options: QueryOptions = { temporal: { mode: 'AsOf', from: pointInTime } };
    const { query, parameters } = dialect.buildSelect(
      Employee,
      options,
      MetadataStorage.getEntity(Employee)
    );
    expect(query).toMatch(/FROM \[employees\] FOR SYSTEM_TIME AS OF @p1/);
    expect(parameters).toEqual([pointInTime]);
  });

  it('temporalAll: emits FOR SYSTEM_TIME ALL after FROM without params', () => {
    const options: QueryOptions = { temporal: { mode: 'All' } };
    const { query, parameters } = dialect.buildSelect(
      Employee,
      options,
      MetadataStorage.getEntity(Employee)
    );
    expect(query).toMatch(/FROM \[employees\] FOR SYSTEM_TIME ALL/);
    expect(parameters).toHaveLength(0);
  });

  it('temporalBetween: emits FOR SYSTEM_TIME BETWEEN @p1 AND @p2', () => {
    const from = new Date('2022-01-01');
    const to = new Date('2023-01-01');
    const options: QueryOptions = { temporal: { mode: 'Between', from, to } };
    const { query, parameters } = dialect.buildSelect(
      Employee,
      options,
      MetadataStorage.getEntity(Employee)
    );
    expect(query).toMatch(/FOR SYSTEM_TIME BETWEEN @p1 AND @p2/);
    expect(parameters).toEqual([from, to]);
  });

  it('temporalFromTo: emits FOR SYSTEM_TIME FROM @p1 TO @p2', () => {
    const from = new Date('2022-01-01');
    const to = new Date('2023-01-01');
    const options: QueryOptions = { temporal: { mode: 'FromTo', from, to } };
    const { query, parameters } = dialect.buildSelect(
      Employee,
      options,
      MetadataStorage.getEntity(Employee)
    );
    expect(query).toMatch(/FOR SYSTEM_TIME FROM @p1 TO @p2/);
    expect(parameters).toEqual([from, to]);
  });

  it('temporalContainedIn: emits FOR SYSTEM_TIME CONTAINED IN (@p1, @p2)', () => {
    const from = new Date('2022-01-01');
    const to = new Date('2023-01-01');
    const options: QueryOptions = { temporal: { mode: 'ContainedIn', from, to } };
    const { query, parameters } = dialect.buildSelect(
      Employee,
      options,
      MetadataStorage.getEntity(Employee)
    );
    expect(query).toMatch(/FOR SYSTEM_TIME CONTAINED IN \(@p1, @p2\)/);
    expect(parameters).toEqual([from, to]);
  });

  it('temporal clause appears between FROM and JOIN/WHERE', () => {
    const pointInTime = new Date('2023-01-01');
    const options: QueryOptions = {
      temporal: { mode: 'AsOf', from: pointInTime },
      where: [{ condition: 'department = ?', parameters: ['Sales'] }]
    };
    const { query } = dialect.buildSelect(Employee, options, MetadataStorage.getEntity(Employee));
    const fromIdx = query.indexOf('FROM [employees]');
    const temporalIdx = query.indexOf('FOR SYSTEM_TIME');
    const whereIdx = query.indexOf('WHERE');
    expect(fromIdx).toBeGreaterThanOrEqual(0);
    expect(temporalIdx).toBeGreaterThan(fromIdx);
    expect(whereIdx).toBeGreaterThan(temporalIdx);
  });

  it('temporal params are numbered before WHERE params', () => {
    const pointInTime = new Date('2023-01-01');
    const options: QueryOptions = {
      temporal: { mode: 'AsOf', from: pointInTime },
      where: [{ condition: 'department = ?', parameters: ['Engineering'] }]
    };
    const { query, parameters } = dialect.buildSelect(
      Employee,
      options,
      MetadataStorage.getEntity(Employee)
    );
    expect(query).toContain('@p1');
    expect(query).toContain('@p2');
    expect(parameters[0]).toBe(pointInTime);
    expect(parameters[1]).toBe('Engineering');
  });

  it('rawSqlSource path ignores temporal clause', () => {
    const options: QueryOptions = {
      temporal: { mode: 'All' },
      rawSqlSource: { sql: 'SELECT * FROM employees_backup', params: [] }
    };
    const { query } = dialect.buildSelect(Employee, options, MetadataStorage.getEntity(Employee));
    expect(query).not.toContain('FOR SYSTEM_TIME');
    expect(query).toContain('FROM (SELECT * FROM employees_backup) AS t0');
  });
});

// ---------------------------------------------------------------------------
// PostgreSQL — throws TemporalNotSupportedError
// ---------------------------------------------------------------------------

describe('PostgresDialect temporal guard', () => {
  let dialect: PostgresDialect;

  beforeEach(() => {
    dialect = new PostgresDialect();
    setupMetadata();
  });

  it('throws TemporalNotSupportedError for AsOf', () => {
    const options: QueryOptions = { temporal: { mode: 'AsOf', from: new Date() } };
    expect(() =>
      dialect.buildSelect(Employee, options, MetadataStorage.getEntity(Employee))
    ).toThrow(TemporalNotSupportedError);
  });

  it('throws TemporalNotSupportedError for All', () => {
    const options: QueryOptions = { temporal: { mode: 'All' } };
    expect(() =>
      dialect.buildSelect(Employee, options, MetadataStorage.getEntity(Employee))
    ).toThrow(TemporalNotSupportedError);
  });

  it('error message mentions FOR SYSTEM_TIME', () => {
    const options: QueryOptions = { temporal: { mode: 'All' } };
    expect(() =>
      dialect.buildSelect(Employee, options, MetadataStorage.getEntity(Employee))
    ).toThrow(/FOR SYSTEM_TIME/);
  });
});

// ---------------------------------------------------------------------------
// MySQL — throws TemporalNotSupportedError
// ---------------------------------------------------------------------------

describe('MysqlDialect temporal guard', () => {
  let dialect: MysqlDialect;

  beforeEach(() => {
    dialect = new MysqlDialect();
    setupMetadata();
  });

  it('throws TemporalNotSupportedError for AsOf', () => {
    const options: QueryOptions = { temporal: { mode: 'AsOf', from: new Date() } };
    expect(() =>
      dialect.buildSelect(Employee, options, MetadataStorage.getEntity(Employee))
    ).toThrow(TemporalNotSupportedError);
  });

  it('throws TemporalNotSupportedError for All', () => {
    const options: QueryOptions = { temporal: { mode: 'All' } };
    expect(() =>
      dialect.buildSelect(Employee, options, MetadataStorage.getEntity(Employee))
    ).toThrow(TemporalNotSupportedError);
  });

  it('error message mentions FOR SYSTEM_TIME', () => {
    const options: QueryOptions = { temporal: { mode: 'All' } };
    expect(() =>
      dialect.buildSelect(Employee, options, MetadataStorage.getEntity(Employee))
    ).toThrow(/FOR SYSTEM_TIME/);
  });
});
