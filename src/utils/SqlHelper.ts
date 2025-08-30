export class SqlHelper {
	/**
	 * Build a WHERE clause from a simple conditions object.
	 * - null/undefined -> IS NULL
	 * - array -> IN (?, ?, ...)
	 * - primitive -> = ?
	 * @param conditions Key/value pairs to translate into SQL.
	 * @returns Object with SQL fragment and parameter list.
	 */
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

	/**
	 * Format a value for inline usage in SQL (e.g., DEFAULT expressions).
	 * Escapes quotes for strings, formats dates as ISO strings.
	 */
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

	/**
	 * Escape an identifier like a column or table name for SQL usage.
	 */
	public static escapeIdentifier(identifier: string): string {
		return `"${identifier.replace(/"/g, '""')}"`;
	}

	/**
	 * Build an ORDER BY clause string from column/direction pairs.
	 */
	public static buildOrderByClause(orderBy: Array<{ column: string; direction: 'ASC' | 'DESC' }>): string {
		if (orderBy.length === 0) {
			return '';
		}
		
		const clauses = orderBy.map(o => `${o.column} ${o.direction}`);
		return `ORDER BY ${clauses.join(', ')}`;
	}

	/**
	 * Build a LIMIT/OFFSET clause string.
	 */
	public static buildLimitClause(limit?: number, offset?: number): string {
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
