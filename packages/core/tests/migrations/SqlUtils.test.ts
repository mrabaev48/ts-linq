import { mapType, groupType, formatValue, norm } from '../../src/migrations/builders/SqlUtils';

test('groupType maps common aliases', () => {
  expect(groupType('INTEGER')).toBe('int');
  expect(groupType('NUMBER')).toBe('int');
  expect(groupType('STRING')).toBe('text');
  expect(groupType('REAL')).toBe('float');
  expect(groupType('BOOLEAN')).toBe('bool');
  expect(groupType('DATE')).toBe('date');
  expect(groupType('UNKNOWN')).toBeNull();
});

test('mapType respects dialect specifics', () => {
  expect(mapType('postgresql', 'INTEGER')).toBe('INTEGER');
  expect(mapType('postgresql', 'DATE')).toBe('TIMESTAMPTZ');
  expect(mapType('mysql', 'BOOLEAN')).toBe('TINYINT(1)');
  expect(mapType('sqlite', 'FLOAT')).toBe('REAL');
  expect(mapType('mssql', 'TEXT')).toBe('NVARCHAR(MAX)');
});

test('formatValue handles booleans and dates', () => {
  expect(formatValue('postgresql', true)).toBe('TRUE');
  expect(formatValue('mysql', false)).toBe('0');
  const d = new Date('2020-01-01T00:00:00.000Z');
  expect(formatValue('sqlite', d)).toBe(`'${d.toISOString()}'`);
  expect(formatValue('postgresql', "O'Reilly")).toBe("'O''Reilly'");
});

test('norm uppercases and trims', () => {
  expect(norm(' int ')).toBe('INT');
});
