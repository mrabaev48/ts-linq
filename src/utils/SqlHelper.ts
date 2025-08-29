export class SqlHelper {
    public static buildWhereClause(conditions: any): { whereClause: string; params: any[] } {
        const clauses: string[] = [];
        const params: any[] = [];

        for (const [key, value] of Object.entries(conditions)) {
            if (value === null || value === undefined) {
                clauses.push(`${key} IS NULL`);
            } else if (Array.isArray(value)) {
                const placeholders = value.map(() => '?').join(', ');
                clauses.push(`${key} IN (${placeholders})`);
                params.push(...value);
            } else {
                clauses.push(`${key} = ?`);
                params.push(value);
            }
        }

        return {
            whereClause: clauses.join(' AND '),
            params
        };
    }

    public static formatValue(value: any): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }
        
        if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
        }
        
        if (typeof value === 'boolean') {
            return value ? '1' : '0';
        }
        
        if (value instanceof Date) {
            return `'${value.toISOString()}'`;
        }
        
        return value.toString();
    }

    public static escapeIdentifier(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    public static buildOrderByClause(orderBy: Array<{ column: string; direction: 'ASC' | 'DESC' }>): string {
        if (orderBy.length === 0) {
            return '';
        }
        
        const clauses = orderBy.map(o => `${o.column} ${o.direction}`);
        return `ORDER BY ${clauses.join(', ')}`;
    }

    public static buildLimitClause(limit?: number, offset?: number): string {
        if (!limit && !offset) {
            return '';
        }
        
        let clause = '';
        if (limit) {
            clause += `LIMIT ${limit}`;
        }
        if (offset) {
            clause += ` OFFSET ${offset}`;
        }
        
        return clause.trim();
    }
}
