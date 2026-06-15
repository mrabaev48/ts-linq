import { QuoterFactory } from '../../src/builders/quoting/QuoterFactory';
import type { SqlQuoter } from '../../src/builders/quoting/SqlQuoter';
import type { Dialect } from '../../src/Dialect';

/**
 * Security contract for the injection-safe quoting layer (migrations/task-1).
 * Adversarial identifiers containing the dialect quote char must be escaped (the char
 * doubled) so they cannot terminate quoting and break out into surrounding SQL.
 */
describe('SqlQuoter — identifier escaping (injection safety)', () => {
  const pg = QuoterFactory.for('postgresql');
  const mysql = QuoterFactory.for('mysql');
  const mssql = QuoterFactory.for('mssql');

  test('PostgreSQL doubles embedded double-quotes', () => {
    expect(pg.id('a"b')).toBe('"a""b"');
    expect(pg.id('users')).toBe('"users"');
    // a closing quote cannot break out: the payload stays inside one quoted identifier
    expect(pg.id('x"; DROP TABLE users;--')).toBe('"x""; DROP TABLE users;--"');
  });

  test('MySQL doubles embedded backticks', () => {
    expect(mysql.id('a`b')).toBe('`a``b`');
    expect(mysql.id('users')).toBe('`users`');
    expect(mysql.id('x`; DROP TABLE users;--')).toBe('`x``; DROP TABLE users;--`');
  });

  test('MSSQL doubles embedded closing brackets', () => {
    expect(mssql.id('a]b')).toBe('[a]]b]');
    expect(mssql.id('users')).toBe('[users]');
    // an opening bracket is harmless and is NOT doubled
    expect(mssql.id('a[b')).toBe('[a[b]');
    expect(mssql.id('x]; DROP TABLE users;--')).toBe('[x]]; DROP TABLE users;--]');
  });

  test('the foreign dialect quote char is left untouched (no false doubling)', () => {
    expect(pg.id('a`b')).toBe('"a`b"');
    expect(mysql.id('a"b')).toBe('`a"b`');
    expect(mssql.id('a"b')).toBe('[a"b]');
  });
});

describe('SqlQuoter — qualified names', () => {
  test('quotes each part and joins with a dot', () => {
    expect(QuoterFactory.for('postgresql').qualified('shared', 'OrderNumbers')).toBe(
      '"shared"."OrderNumbers"'
    );
    expect(QuoterFactory.for('mssql').qualified('dbo', 'Seq')).toBe('[dbo].[Seq]');
  });

  test('escapes adversarial parts independently', () => {
    expect(QuoterFactory.for('postgresql').qualified('a"b', 'c"d')).toBe('"a""b"."c""d"');
  });
});

describe('SqlQuoter — literal encoding (folds the legacy formatValue)', () => {
  const cases: Array<[Dialect, unknown, string]> = [
    ['postgresql', null, 'NULL'],
    ['postgresql', 42, '42'],
    ['postgresql', true, 'TRUE'],
    ['postgresql', false, 'FALSE'],
    ['mysql', true, '1'],
    ['mysql', false, '0'],
    ['mssql', true, '1'],
    ['mssql', false, '0'],
    ['postgresql', "O'Brien", "'O''Brien'"],
    ['postgresql', 'plain', "'plain'"]
  ];

  test.each(cases)('%s literal(%p) -> %s', (dialect, value, expected) => {
    expect(QuoterFactory.for(dialect).literal(value)).toBe(expected);
  });

  test('Date is rendered as an ISO string literal', () => {
    const d = new Date('2020-01-02T03:04:05.000Z');
    expect(QuoterFactory.for('postgresql').literal(d)).toBe("'2020-01-02T03:04:05.000Z'");
  });

  test('single quotes in string values are doubled (cannot break out)', () => {
    expect(QuoterFactory.for('mysql').literal("x'; DROP TABLE t;--")).toBe(
      "'x''; DROP TABLE t;--'"
    );
  });
});

describe('SqlQuoter — round-trip property (escape is reversible)', () => {
  // Stripping the wrapper and un-doubling the escaped char returns the original identifier.
  const unquote: Record<Dialect, (q: string) => string> = {
    postgresql: (s) => s.slice(1, -1).split('""').join('"'),
    mysql: (s) => s.slice(1, -1).split('``').join('`'),
    mssql: (s) => s.slice(1, -1).split(']]').join(']')
  };

  const samples = ['users', 'a"b', 'a`b', 'a]b', 'a[b', 'mixed "`] chars', ''];

  for (const dialect of ['postgresql', 'mysql', 'mssql'] as const) {
    const quoter: SqlQuoter = QuoterFactory.for(dialect);
    test(`${dialect}: id() then unquote round-trips`, () => {
      for (const s of samples) {
        expect(unquote[dialect](quoter.id(s))).toBe(s);
      }
    });
  }
});
