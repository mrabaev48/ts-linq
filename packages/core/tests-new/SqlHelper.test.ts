import { SqlHelper } from '../src/utils/SqlHelper';

describe('SqlHelper', () => {
  describe('escapeIdentifier()', () => {
    it('should wrap identifier in double quotes', () => {
      expect(SqlHelper.escapeIdentifier('tableName')).toBe('"tableName"');
    });

    it('should handle identifiers with spaces', () => {
      expect(SqlHelper.escapeIdentifier('table name')).toBe('"table name"');
    });

    it('should handle empty string', () => {
      expect(SqlHelper.escapeIdentifier('')).toBe('""');
    });

    it('should handle special characters', () => {
      expect(SqlHelper.escapeIdentifier('table-name_123')).toBe('"table-name_123"');
    });

    it('should escape existing double quotes by doubling them', () => {
      expect(SqlHelper.escapeIdentifier('table"name')).toBe('"table""name"');
    });

    it('should handle multiple double quotes', () => {
      expect(SqlHelper.escapeIdentifier('a"b"c')).toBe('"a""b""c"');
    });
  });

  describe('formatValue()', () => {
    it('should format null as NULL', () => {
      expect(SqlHelper.formatValue(null)).toBe('NULL');
      expect(SqlHelper.formatValue(undefined)).toBe('NULL');
    });

    it('should wrap strings in single quotes', () => {
      expect(SqlHelper.formatValue('test')).toBe("'test'");
    });

    it('should escape single quotes in strings', () => {
      expect(SqlHelper.formatValue("O'Reilly")).toBe("'O''Reilly'");
    });

    it('should format numbers as-is', () => {
      expect(SqlHelper.formatValue(42)).toBe('42');
      expect(SqlHelper.formatValue(3.14)).toBe('3.14');
    });

    it('should format booleans as 1/0', () => {
      expect(SqlHelper.formatValue(true)).toBe('1');
      expect(SqlHelper.formatValue(false)).toBe('0');
    });

    it('should format Dates as ISO strings in quotes', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(SqlHelper.formatValue(date)).toBe("'2024-01-15T10:30:00.000Z'");
    });
  });

  describe('buildWhereClause()', () => {
    it('should build WHERE clause for simple conditions', () => {
      const result = SqlHelper.buildWhereClause({ name: 'John', age: 30 });

      expect(result.whereClause).toBe('name = ? AND age = ?');
      expect(result.params).toEqual(['John', 30]);
    });

    it('should return empty clause for empty conditions', () => {
      const result = SqlHelper.buildWhereClause({});

      expect(result.whereClause).toBe('');
      expect(result.params).toEqual([]);
    });

    it('should handle NULL values with IS NULL', () => {
      const result = SqlHelper.buildWhereClause({ email: null });

      expect(result.whereClause).toBe('email IS NULL');
      expect(result.params).toEqual([]);
    });

    it('should handle array values with IN clause', () => {
      const result = SqlHelper.buildWhereClause({ status: ['active', 'pending'] });

      expect(result.whereClause).toBe('status IN (?, ?)');
      expect(result.params).toEqual(['active', 'pending']);
    });

    it('should handle mixed conditions', () => {
      const result = SqlHelper.buildWhereClause({
        name: 'John',
        status: null,
        ids: [1, 2, 3]
      });

      expect(result.whereClause).toContain('name = ?');
      expect(result.whereClause).toContain('status IS NULL');
      expect(result.whereClause).toContain('ids IN (?, ?, ?)');
      expect(result.whereClause).toContain('AND');
      expect(result.params).toEqual(['John', 1, 2, 3]);
    });
  });

  describe('buildOrderByClause()', () => {
    it('should build ORDER BY clause', () => {
      const result = SqlHelper.buildOrderByClause([
        { column: 'name', direction: 'ASC' },
        { column: 'age', direction: 'DESC' }
      ]);

      expect(result).toBe('ORDER BY name ASC, age DESC');
    });

    it('should return empty string for empty array', () => {
      const result = SqlHelper.buildOrderByClause([]);

      expect(result).toBe('');
    });

    it('should handle single column', () => {
      const result = SqlHelper.buildOrderByClause([{ column: 'id', direction: 'ASC' }]);

      expect(result).toBe('ORDER BY id ASC');
    });
  });

  describe('buildLimitClause()', () => {
    it('should build LIMIT clause', () => {
      expect(SqlHelper.buildLimitClause(10)).toBe('LIMIT 10');
    });

    it('should build OFFSET clause', () => {
      expect(SqlHelper.buildLimitClause(undefined, 20)).toBe('OFFSET 20');
    });

    it('should build LIMIT and OFFSET', () => {
      expect(SqlHelper.buildLimitClause(10, 20)).toBe('LIMIT 10 OFFSET 20');
    });

    it('should return empty string when both undefined', () => {
      expect(SqlHelper.buildLimitClause()).toBe('');
      expect(SqlHelper.buildLimitClause(undefined, undefined)).toBe('');
    });

    it('should ignore zero limit', () => {
      expect(SqlHelper.buildLimitClause(0)).toBe('');
    });

    it('should handle zero offset', () => {
      expect(SqlHelper.buildLimitClause(10, 0)).toBe('LIMIT 10 OFFSET 0');
    });

    it('should ignore negative limit', () => {
      expect(SqlHelper.buildLimitClause(-5)).toBe('');
    });
  });
});
