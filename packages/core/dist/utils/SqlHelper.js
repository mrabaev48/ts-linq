"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlHelper = void 0;
var SqlInlineValueType;
(function (SqlInlineValueType) {
    SqlInlineValueType["String"] = "string";
    SqlInlineValueType["Number"] = "number";
    SqlInlineValueType["Boolean"] = "boolean";
    SqlInlineValueType["Object"] = "object";
})(SqlInlineValueType || (SqlInlineValueType = {}));
class SqlHelper {
    /**
     * Build a WHERE clause from a simple conditions object.
     * - null/undefined -> IS NULL
     * - array -> IN (?, ?, ...)
     * - primitive -> = ?
     * @param conditions Key/value pairs to translate into SQL.
     * @returns Object with SQL fragment and parameter list.
     */
    static buildWhereClause(conditions) {
        const clauses = [];
        const params = [];
        for (const [key, value] of Object.entries(conditions)) {
            if (value === null || value === undefined) {
                clauses.push(`${key} IS NULL`);
            }
            else if (Array.isArray(value)) {
                const placeholders = value.map(() => '?').join(', ');
                clauses.push(`${key} IN (${placeholders})`);
                for (const arrayValue of value)
                    params.push(SqlHelper.ensureSqlParameter(arrayValue));
            }
            else {
                clauses.push(`${key} = ?`);
                params.push(SqlHelper.ensureSqlParameter(value));
            }
        }
        return {
            whereClause: clauses.join(' AND '),
            params
        };
    }
    /** Coerce an arbitrary value into a SqlParameter. */
    static ensureSqlParameter(value) {
        if (value === null ||
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            value instanceof Date ||
            value instanceof Uint8Array) {
            return value;
        }
        // Fallback: JSON-encode objects (including arrays) into TEXT
        try {
            return JSON.stringify(value ?? null);
        }
        catch {
            return String(value);
        }
    }
    /**
     * Format a value for inline usage in SQL (e.g., DEFAULT expressions).
     * Escapes quotes for strings, formats dates as ISO strings.
     */
    static formatValue(value) {
        if (value === null || value === undefined) {
            return 'NULL';
        }
        if (typeof value === SqlInlineValueType.String) {
            return `'${value.replace(/'/g, "''")}'`;
        }
        if (typeof value === SqlInlineValueType.Boolean) {
            return value ? '1' : '0';
        }
        if (value instanceof Date) {
            return `'${value.toISOString()}'`;
        }
        return String(value);
    }
    /** Escape an identifier like a column or table name for SQL usage. */
    static escapeIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    /** Build an ORDER BY clause string from column/direction pairs. */
    static buildOrderByClause(orderBy) {
        if (orderBy.length === 0) {
            return '';
        }
        const clauses = orderBy.map((o) => `${o.column} ${o.direction}`);
        return `ORDER BY ${clauses.join(', ')}`;
    }
    /** Build a LIMIT/OFFSET clause string. */
    static buildLimitClause(limit, offset) {
        const hasLimit = typeof limit === 'number' && limit > 0;
        const hasOffset = typeof offset === 'number' && offset >= 0;
        if (!hasLimit && !hasOffset) {
            return '';
        }
        let clause = '';
        if (hasLimit) {
            clause += `LIMIT ${limit}`;
        }
        if (hasOffset) {
            clause += (clause ? ' ' : '') + `OFFSET ${offset}`;
        }
        return clause.trim();
    }
}
exports.SqlHelper = SqlHelper;
//# sourceMappingURL=SqlHelper.js.map