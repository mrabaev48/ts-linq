import { SqlHelper } from '../src/utils/SqlHelper';

describe('SqlHelper', () => {
    describe('buildWhereClause', () => {
        it('should build simple equality conditions', () => {
            const conditions = { name: 'John', age: 25 };
            const result = SqlHelper.buildWhereClause(conditions);

            expect(result.whereClause).toBe('name = ? AND age = ?');
            expect(result.params).toEqual(['John', 25]);
        });

        it('should handle null values with IS NULL', () => {
            const conditions = { name: null, email: undefined };
            const result = SqlHelper.buildWhereClause(conditions);

            expect(result.whereClause).toBe('name IS NULL AND email IS NULL');
            expect(result.params).toEqual([]);
        });

        it('should handle array values with IN clause', () => {
            const conditions = { id: [1, 2, 3], status: ['active', 'pending'] };
            const result = SqlHelper.buildWhereClause(conditions);

            expect(result.whereClause).toBe('id IN (?, ?, ?) AND status IN (?, ?)');
            expect(result.params).toEqual([1, 2, 3, 'active', 'pending']);
        });

        it('should handle mixed conditions', () => {
            const conditions = {
                name: 'John',
                age: null,
                status: ['active', 'pending'],
                score: 95
            };
            const result = SqlHelper.buildWhereClause(conditions);

            expect(result.whereClause).toBe('name = ? AND age IS NULL AND status IN (?, ?) AND score = ?');
            expect(result.params).toEqual(['John', 'active', 'pending', 95]);
        });

        it('should handle empty conditions', () => {
            const conditions = {};
            const result = SqlHelper.buildWhereClause(conditions);

            expect(result.whereClause).toBe('');
            expect(result.params).toEqual([]);
        });

        it('should handle empty arrays', () => {
            const conditions = { tags: [] };
            const result = SqlHelper.buildWhereClause(conditions);

            expect(result.whereClause).toBe('tags IN ()');
            expect(result.params).toEqual([]);
        });
    });

    describe('formatValue', () => {
        it('should format null and undefined', () => {
            expect(SqlHelper.formatValue(null)).toBe('NULL');
            expect(SqlHelper.formatValue(undefined)).toBe('NULL');
        });

        it('should format strings with proper escaping', () => {
            expect(SqlHelper.formatValue('hello')).toBe("'hello'");
            expect(SqlHelper.formatValue("it's")).toBe("'it''s'");
            expect(SqlHelper.formatValue('')).toBe("''");
        });

        it('should format booleans as integers', () => {
            expect(SqlHelper.formatValue(true)).toBe('1');
            expect(SqlHelper.formatValue(false)).toBe('0');
        });

        it('should format dates as ISO strings', () => {
            const date = new Date('2023-01-01T00:00:00.000Z');
            expect(SqlHelper.formatValue(date)).toBe("'2023-01-01T00:00:00.000Z'");
        });

        it('should format numbers as-is', () => {
            expect(SqlHelper.formatValue(42)).toBe('42');
            expect(SqlHelper.formatValue(3.14)).toBe('3.14');
            expect(SqlHelper.formatValue(0)).toBe('0');
            expect(SqlHelper.formatValue(-10)).toBe('-10');
        });

        it('should format other types as strings', () => {
            expect(SqlHelper.formatValue({ key: 'value' })).toBe('[object Object]');
            expect(SqlHelper.formatValue([1, 2, 3])).toBe('1,2,3');
        });
    });

    describe('escapeIdentifier', () => {
        it('should escape identifiers with double quotes', () => {
            expect(SqlHelper.escapeIdentifier('columnName')).toBe('"columnName"');
            expect(SqlHelper.escapeIdentifier('table_name')).toBe('"table_name"');
        });

        it('should escape double quotes in identifiers', () => {
            expect(SqlHelper.escapeIdentifier('column"name')).toBe('"column""name"');
            expect(SqlHelper.escapeIdentifier('"quoted"')).toBe('"""quoted"""');
        });

        it('should handle empty identifiers', () => {
            expect(SqlHelper.escapeIdentifier('')).toBe('""');
        });
    });

    describe('buildOrderByClause', () => {
        it('should build ORDER BY clause with single column', () => {
            const orderBy = [{ column: 'name', direction: 'ASC' as const }];
            const result = SqlHelper.buildOrderByClause(orderBy);

            expect(result).toBe('ORDER BY name ASC');
        });

        it('should build ORDER BY clause with multiple columns', () => {
            const orderBy = [
                { column: 'name', direction: 'ASC' as const },
                { column: 'age', direction: 'DESC' as const },
                { column: 'created_at', direction: 'ASC' as const }
            ];
            const result = SqlHelper.buildOrderByClause(orderBy);

            expect(result).toBe('ORDER BY name ASC, age DESC, created_at ASC');
        });

        it('should return empty string for empty array', () => {
            const result = SqlHelper.buildOrderByClause([]);
            expect(result).toBe('');
        });
    });

    describe('buildLimitClause', () => {
        it('should build LIMIT clause only', () => {
            const result = SqlHelper.buildLimitClause(10);
            expect(result).toBe('LIMIT 10');
        });

        it('should build OFFSET clause only', () => {
            const result = SqlHelper.buildLimitClause(undefined, 5);
            expect(result).toBe('OFFSET 5');
        });

        it('should build LIMIT and OFFSET clauses', () => {
            const result = SqlHelper.buildLimitClause(10, 5);
            expect(result).toBe('LIMIT 10 OFFSET 5');
        });

        it('should return empty string when both are undefined', () => {
            const result = SqlHelper.buildLimitClause();
            expect(result).toBe('');
        });

        it('should handle zero values', () => {
            expect(SqlHelper.buildLimitClause(0)).toBe('');
            expect(SqlHelper.buildLimitClause(undefined, 0)).toBe('OFFSET 0');
            expect(SqlHelper.buildLimitClause(0, 0)).toBe('OFFSET 0');
        });
    });
});
