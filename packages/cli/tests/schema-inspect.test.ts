import { normalizeDbType, tsTypeForOrm } from '../src/schema-inspect';

describe('schema-inspect helpers', () => {
  it('normalizeDbType maps vendor types to ORM types', () => {
    expect(normalizeDbType('postgresql', 'integer')).toBe('INTEGER');
    expect(normalizeDbType('postgresql', 'uuid')).toBe('UUID');
    expect(normalizeDbType('mysql', 'json')).toBe('JSON');
    expect(normalizeDbType('mssql', 'uniqueidentifier')).toBe('UUID');
    expect(normalizeDbType('postgresql', 'varchar')).toBe('TEXT');
  });

  it('tsTypeForOrm returns TS type for ORM type', () => {
    expect(tsTypeForOrm('INTEGER')).toBe('number');
    expect(tsTypeForOrm('DECIMAL')).toBe('number');
    expect(tsTypeForOrm('BOOLEAN')).toBe('boolean');
    expect(tsTypeForOrm('DATETIME')).toBe('Date');
    expect(tsTypeForOrm('BLOB')).toBe('Buffer');
    expect(tsTypeForOrm('UUID')).toBe('string');
    expect(tsTypeForOrm('JSON')).toBe('unknown');
    expect(tsTypeForOrm('JSONB')).toBe('unknown');
    expect(tsTypeForOrm('TEXT')).toBe('string');
  });
});
