import type { DialectCapabilities, EntityMetadata, QueryOptions } from '@ts-linq/types';

import { AbstractSqlDialect, type DialectSyntax, type InsertDecoration } from '../src';

/**
 * A deterministic fake {@link DialectSyntax} that makes each injected token visibly distinct, so a
 * test can assert *where* the base algorithm placed it: identifiers become `<id>`, the SELECT head
 * and LIMIT/OFFSET fragments carry sentinel markers, and placeholders are left untouched.
 */
const fakeSyntax: DialectSyntax = {
  quote: (id) => `<${id}>`,
  quoteStringLiteral: (v) => `'${v}'`,
  renumberPlaceholders: (sql) => sql,
  renderSelectHead: (options) =>
    `SELECT ${options.select && options.select.length ? options.select.join(', ') : '*'}`,
  renderLimitOffset: (options) => (options.limit != null ? ` LIMIT ${options.limit}` : ''),
  insertColumnSeparator: ','
};

/** Concrete base subclass wired to the fake syntax, recording which hooks the template invoked. */
class TestDialect extends AbstractSqlDialect {
  protected readonly syntax = fakeSyntax;
  readonly calls: string[] = [];
  public readonly capabilities: DialectCapabilities = {
    crud: true,
    batch: false,
    bulk: true,
    storedProcedures: false,
    temporal: false
  };

  constructor(private readonly meta?: EntityMetadata) {
    super();
  }

  protected getEntityMetadata(): EntityMetadata | undefined {
    this.calls.push('getEntityMetadata');
    return this.meta;
  }

  protected assertTemporalSupported(): void {
    this.calls.push('assertTemporalSupported');
  }

  protected applyCtePrefix(query: string): string {
    this.calls.push('applyCtePrefix');
    return query;
  }

  protected getInsertDecoration(): InsertDecoration {
    this.calls.push('getInsertDecoration');
    return { returning: ' RETURNING *' };
  }
}

const table = 'users';

function metadata(): EntityMetadata {
  return {
    tableName: table,
    columns: [
      { propertyName: 'id', columnName: 'id' },
      { propertyName: 'name', columnName: 'name' }
    ],
    primaryKeys: ['id']
  } as unknown as EntityMetadata;
}

class Users {}

describe('AbstractSqlDialect (Template Method)', () => {
  it('assembles SELECT clauses in the invariant order via the injected syntax', () => {
    const dialect = new TestDialect(metadata());
    const options: QueryOptions = {
      select: ['id', 'name'],
      where: [{ condition: 'id = ?', parameters: [1] }],
      orderBy: [{ column: 'name', direction: 'ASC' }],
      limit: 10
    } as unknown as QueryOptions;

    const { query } = dialect.buildSelect(Users, options);

    // head → FROM(<quoted>) → WHERE → ORDER BY → LIMIT, in that order.
    expect(query).toBe('SELECT id, name FROM <users> WHERE id = ? ORDER BY name ASC LIMIT 10');
    // Temporal + CTE hooks run before metadata resolution.
    expect(dialect.calls).toEqual([
      'assertTemporalSupported',
      'applyCtePrefix',
      'getEntityMetadata'
    ]);
  });

  it('collects SELECT-clause params before FROM/WHERE params', () => {
    const dialect = new TestDialect(metadata());
    const options: QueryOptions = {
      select: ['?'],
      selectParams: ['select-param'],
      where: [{ condition: 'id = ?', parameters: ['where-param'] }]
    } as unknown as QueryOptions;

    const { parameters } = dialect.buildSelect(Users, options);
    expect(parameters).toEqual(['select-param', 'where-param']);
  });

  it('throws when the entity metadata cannot be resolved', () => {
    const dialect = new TestDialect(undefined);
    expect(() => dialect.buildSelect(Users, {} as QueryOptions)).toThrow(/metadata not found/i);
  });

  it('applies INSERT decoration and the injected column separator', () => {
    const dialect = new TestDialect(metadata());
    const result = dialect.buildInsert({ id: 1, name: 'Alice' }, metadata());
    // primary key `id` is supplied, so it is included; separator is the fake `,` (no space).
    expect(result.sql).toBe('INSERT INTO <users> (<id>,<name>) VALUES (?,?) RETURNING *');
    expect(result.parameters).toEqual([1, 'Alice']);
    expect(dialect.calls).toContain('getInsertDecoration');
  });

  it('builds UPDATE with SET params before PK-WHERE params', () => {
    const dialect = new TestDialect(metadata());
    const result = dialect.buildUpdate({ id: 7, name: 'Bob' }, metadata());
    expect(result.sql).toBe('UPDATE <users> SET <name> = ? WHERE <id> = ?');
    expect(result.parameters).toEqual(['Bob', 7]);
  });

  it('throws when UPDATE has no updatable columns (unified guard)', () => {
    const pkOnly = {
      tableName: table,
      columns: [{ propertyName: 'id', columnName: 'id' }],
      primaryKeys: ['id']
    } as unknown as EntityMetadata;
    const dialect = new TestDialect(pkOnly);
    expect(() => dialect.buildUpdate({ id: 1 }, pkOnly)).toThrow(/no updatable columns/i);
  });
});
