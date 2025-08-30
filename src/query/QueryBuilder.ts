import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SqlHelper } from '../utils/SqlHelper';
import { JoinType, WhereClause, OrderByClause, GroupByClause, QueryOptions } from '../types';

/**
 * Fluent SQL query builder that offers LINQ-like methods for filtering,
 * projection, ordering, grouping, joins, and pagination over an entity type.
 */
export class QueryBuilder<T> {
    private _entityClass: new () => T;
    private _provider: DatabaseProvider;
    private _options: QueryOptions = {};
    private _fallbackPredicates: Array<(entity: T) => boolean> = [];
    private _entityLoader?: any; // late injected for eager includes
    private _includes: string[] = [];

    /**
     * Create a query builder bound to an entity and a database provider.
     * @param entityClass Constructor of the entity type to query.
     * @param provider Underlying provider used to execute SQL.
     */
    constructor(entityClass: new () => T, provider: DatabaseProvider, entityLoader?: any) {
        this._entityClass = entityClass;
        this._provider = provider;
        this._entityLoader = entityLoader;
    }

    /**
     * Filter rows using a boolean predicate. Only common simple expressions are parsed.
     * @param predicate A boolean-returning function that references entity properties.
     * @returns This builder for chaining.
     */
    public where(predicate: (entity: T) => boolean): QueryBuilder<T> {
        const predicateStr = predicate.toString();
        const parsed = this.parsePredicateToSql(predicateStr);

        if (!parsed.parsed) {
            // Fallback to client-side filtering when predicate can't be reliably parsed
            this._fallbackPredicates.push(predicate);
        } else {
            const whereClause: WhereClause = {
                condition: parsed.condition,
                parameters: parsed.parameters
            };
            this._options.where = this._options.where || [];
            this._options.where.push(whereClause);
        }
        return this;
    }

    /**
     * Project rows into a subset or transformed shape. Limited selector parsing support.
     * @param selector Projection function selecting properties.
     * @returns A new builder typed to the projection result.
     */
    public select<TResult>(selector: (entity: T) => TResult): QueryBuilder<TResult> {
        // Create a new QueryBuilder with the result type
        const newBuilder = new QueryBuilder<TResult>(this._entityClass as any, this._provider);
        newBuilder._options = { ...this._options };
        
        // Parse selector function to extract property names
        const selectorStr = selector.toString();
        const properties = this.extractPropertiesFromSelector(selectorStr);
        newBuilder._options.select = properties;
        
        return newBuilder;
    }

    /**
     * Order results ascending by a property.
     * @param keySelector Function returning the sort key.
     * @returns This builder for chaining.
     */
    public orderBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        
        const orderByClause: OrderByClause = {
            column,
            direction: 'ASC'
        };
        
        this._options.orderBy = this._options.orderBy || [];
        this._options.orderBy.push(orderByClause);
        return this;
    }

    /**
     * Order results descending by a property.
     * @param keySelector Function returning the sort key.
     * @returns This builder for chaining.
     */
    public orderByDescending<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        
        const orderByClause: OrderByClause = {
            column,
            direction: 'DESC'
        };
        
        this._options.orderBy = this._options.orderBy || [];
        this._options.orderBy.push(orderByClause);
        return this;
    }

    /**
     * Limit the number of returned rows.
     * @param count Maximum number of rows to return.
     * @returns This builder for chaining.
     */
    public take(count: number): QueryBuilder<T> {
        this._options.limit = count;
        return this;
    }

    /**
     * Skip a number of rows before returning results.
     * @param count Number of rows to skip.
     * @returns This builder for chaining.
     */
    public skip(count: number): QueryBuilder<T> {
        this._options.offset = count;
        return this;
    }

    /**
     * Make the SELECT clause distinct.
     * @returns This builder for chaining.
     */
    public distinct(): QueryBuilder<T> {
        this._options.distinct = true;
        return this;
    }

    /**
     * Join with another entity table via a boolean condition.
     * @param otherEntity Constructor of the joined entity.
     * @param condition Join predicate between outer and inner entities.
     * @param type Join type, defaults to INNER.
     * @returns This builder for chaining.
     */
    public join<TOther>(
        otherEntity: new () => TOther,
        condition: (outer: T, inner: TOther) => boolean,
        type: JoinType = JoinType.Inner
    ): QueryBuilder<T> {
        const otherMetadata = MetadataStorage.getEntity(otherEntity);
        if (!otherMetadata) {
            throw new Error(`Entity metadata not found for ${otherEntity.name}`);
        }

        // Enhanced join condition parsing
        const conditionStr = condition.toString();
        const joinClause = {
            type,
            table: otherMetadata.tableName,
            on: this.parseJoinCondition(conditionStr),
            alias: otherEntity.name.toLowerCase()
        };

        this._options.joins = this._options.joins || [];
        this._options.joins.push(joinClause);
        return this;
    }

    /**
     * Convenience for LEFT JOIN.
     * @param otherEntity Constructor of the joined entity.
     * @param condition Join predicate between outer and inner entities.
     * @returns This builder for chaining.
     */
    public leftJoin<TOther>(
        otherEntity: new () => TOther,
        condition: (outer: T, inner: TOther) => boolean
    ): QueryBuilder<T> {
        return this.join(otherEntity, condition, JoinType.Left);
    }

    /**
     * Group results by one or more properties.
     * @param keySelector Selector that indicates columns to group by.
     * @returns This builder for chaining.
     */
    public groupBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        const keySelectorStr = keySelector.toString();
        const columns = this.extractPropertiesFromSelector(keySelectorStr);
        
        this._options.groupBy = {
            columns
        };
        return this;
    }

    /**
     * Apply a HAVING filter to grouped results.
     * @param predicate Predicate over aggregated groups.
     * @returns This builder for chaining.
     */
    public having(predicate: (group: any) => boolean): QueryBuilder<T> {
        if (!this._options.groupBy) {
            throw new Error('Having clause requires a GroupBy clause');
        }

        const predicateStr = predicate.toString();
        const { condition, parameters } = this.parsePredicateToSql(predicateStr);

        const whereClause: WhereClause = {
            condition,
            parameters
        };

        this._options.groupBy.having = whereClause;
        return this;
    }

    /**
     * Execute the built query and return mapped entities.
     * @returns Array of entities matching the query.
     */
    public async toArray(): Promise<T[]> {
        const sql = this.generateSql();
        const results = await this._provider.executeQuery<any>(sql.query, sql.parameters);
        let entities = results.map(row => this.mapRowToEntity(row));
        if (this._fallbackPredicates.length > 0) {
            for (const pred of this._fallbackPredicates) {
                entities = entities.filter(e => {
                    try { return pred(e); } catch { return false; }
                });
            }
        }
        if (this._entityLoader && this._includes.length > 0) {
            // Eager populate requested includes for each entity
            for (const e of entities) {
                await this._entityLoader.populateRelationships(e, this._entityClass, {
                    strategy: 'eager' as any,
                    includes: this._includes,
                    depth: 1
                });
            }
        }
        return entities;
    }

    /**
     * Return the first entity or throw if sequence is empty.
     */
    public async first(): Promise<T> {
        this._options.limit = 1;
        const results = await this.toArray();
        if (results.length === 0) {
            throw new Error('Sequence contains no elements');
        }
        return results[0];
    }

    /**
     * Return the first entity or null if sequence is empty.
     */
    public async firstOrDefault(): Promise<T | null> {
        this._options.limit = 1;
        const results = await this.toArray();
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Return the single entity or throw if none or more than one exist.
     */
    public async single(): Promise<T> {
        const results = await this.toArray();
        if (results.length === 0) {
            throw new Error('Sequence contains no elements');
        }
        if (results.length > 1) {
            throw new Error('Sequence contains more than one element');
        }
        return results[0];
    }

    /**
     * Return the single entity or null if none exist; throws if multiple exist.
     */
    public async singleOrDefault(): Promise<T | null> {
        const results = await this.toArray();
        if (results.length > 1) {
            throw new Error('Sequence contains more than one element');
        }
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Count rows matching the current query options.
     * @returns Number of rows.
     */
    public async count(): Promise<number> {
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
        }

        // Build count query with WHERE conditions if any
        let query = `SELECT COUNT(*) as count FROM ${metadata.tableName}`;
        let parameters: any[] = [];

        // Add WHERE clause if exists
        if (this._options.where && this._options.where.length > 0) {
            const whereClauses = this._options.where.map(w => w.condition);
            query += ` WHERE ${whereClauses.join(' AND ')}`;
            
            for (const where of this._options.where) {
                parameters.push(...where.parameters);
            }
        }

        const results = await this._provider.executeQuery<{ count: number }>(query, parameters);
        return results[0].count;
    }

    /**
     * Determine whether any rows match the query.
     * @returns True if at least one row exists.
     */
    public async any(): Promise<boolean> {
        this._options.limit = 1;
        const results = await this.toArray();
        return results.length > 0;
    }

    private generateSql(): { query: string; parameters: any[] } {
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
        }

        let query = 'SELECT ';
        
        // SELECT clause
        if (this._options.distinct) {
            query += 'DISTINCT ';
        }
        
        if (this._options.select && this._options.select.length > 0) {
            query += this._options.select.join(', ');
        } else {
            query += '*';
        }
        
        query += ` FROM ${metadata.tableName}`;

        // JOIN clauses
        if (this._options.joins) {
            for (const join of this._options.joins) {
                query += ` ${join.type} JOIN ${join.table}`;
                if (join.alias) {
                    query += ` AS ${join.alias}`;
                }
                query += ` ON ${join.on}`;
            }
        }

        const parameters: any[] = [];

        // WHERE clause
        if (this._options.where && this._options.where.length > 0) {
            const whereClauses = this._options.where.map(w => w.condition);
            query += ` WHERE ${whereClauses.join(' AND ')}`;
            
            for (const where of this._options.where) {
                parameters.push(...where.parameters);
            }
        }

        // GROUP BY clause
        if (this._options.groupBy) {
            query += ` GROUP BY ${this._options.groupBy.columns.join(', ')}`;
            
            if (this._options.groupBy.having) {
                query += ` HAVING ${this._options.groupBy.having.condition}`;
                parameters.push(...this._options.groupBy.having.parameters);
            }
        }

        // ORDER BY clause
        if (this._options.orderBy && this._options.orderBy.length > 0) {
            const orderByClauses = this._options.orderBy.map(o => `${o.column} ${o.direction}`);
            query += ` ORDER BY ${orderByClauses.join(', ')}`;
        }

        // LIMIT and OFFSET (SQLite requires LIMIT when using OFFSET)
        const hasLimit = this._options.limit !== undefined && this._options.limit !== null;
        const hasOffset = this._options.offset !== undefined && this._options.offset !== null;
        if (hasLimit) {
            query += ` LIMIT ${this._options.limit}`;
            if (hasOffset) {
                query += ` OFFSET ${this._options.offset}`;
            }
        } else if (hasOffset) {
            // SQLite accepts LIMIT -1 to mean "no limit"
            query += ` LIMIT -1 OFFSET ${this._options.offset}`;
        }

        return { query, parameters };
    }

    /**
     * Convert a JavaScript predicate string into a SQL condition and parameters.
     * Intended for simple, common cases; not a full expression parser.
     */
    private parsePredicateToSql(predicateStr: string): { condition: string; parameters: any[]; parsed: boolean } {
        // Enhanced predicate parsing for common patterns
        // This is a simplified version - a full implementation would use a proper expression parser
        
        // Handle simple equality: p => p.property === value
        const equalityMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*===?\s*(.+)/);
        if (equalityMatch) {
            const property = equalityMatch[2];
            let value = equalityMatch[3].trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
                return {
                    condition: `${property} = ?`,
                    parameters: [value],
                    parsed: true
                };
            }

            // Numeric literal
            const asNumber = Number(value);
            if (!Number.isNaN(asNumber)) {
                return {
                    condition: `${property} = ?`,
                    parameters: [asNumber],
                    parsed: true
                };
            }

            // If RHS looks like a variable or property path (e.g., user.id),
            // we cannot reliably parse it to SQL. Defer to fallback filtering.
            return { condition: '1=1', parameters: [], parsed: false };
        }

        // Handle greater than: p => p.property > value
        const gtMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*>\s*(.+)/);
        if (gtMatch) {
            const property = gtMatch[2];
            const num = Number(gtMatch[3]);
            if (!Number.isNaN(num)) {
                return { condition: `${property} > ?`, parameters: [num], parsed: true };
            }
            return { condition: '1=1', parameters: [], parsed: false };
        }

        // Handle greater than or equal: p => p.property >= value
        const gteMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*>?=\s*(.+)/);
        if (gteMatch) {
            const property = gteMatch[2];
            const num = Number(gteMatch[3]);
            if (!Number.isNaN(num)) {
                return { condition: `${property} >= ?`, parameters: [num], parsed: true };
            }
            return { condition: '1=1', parameters: [], parsed: false };
        }

        // Handle less than: p => p.property < value
        const ltMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*<\s*(.+)/);
        if (ltMatch) {
            const property = ltMatch[2];
            const num = Number(ltMatch[3]);
            if (!Number.isNaN(num)) {
                return { condition: `${property} < ?`, parameters: [num], parsed: true };
            }
            return { condition: '1=1', parameters: [], parsed: false };
        }

        // Handle less than or equal: p => p.property <= value
        const lteMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*<=\s*(.+)/);
        if (lteMatch) {
            const property = lteMatch[2];
            const num = Number(lteMatch[3]);
            if (!Number.isNaN(num)) {
                return { condition: `${property} <= ?`, parameters: [num], parsed: true };
            }
            return { condition: '1=1', parameters: [], parsed: false };
        }

        // Handle compound conditions: p => p.prop1 === value1 && p.prop2 > value2
        const compoundMatch = predicateStr.match(/(\w+)\s*=>\s*(.+)/);
        if (compoundMatch) {
            const expression = compoundMatch[2];
            
            // Split by && and process each part
            if (expression.includes('&&')) {
                const parts = expression.split('&&');
                const conditions: string[] = [];
                const parameters: any[] = [];
                
                for (const part of parts) {
                    const result = this.parseSimpleCondition(part.trim());
                    if (result) {
                        conditions.push(result.condition);
                        parameters.push(...result.parameters);
                    }
                }
                
                if (conditions.length > 0) {
                    return { condition: conditions.join(' AND '), parameters, parsed: true };
                }
                return { condition: '1=1', parameters: [], parsed: false };
            }
        }

        // Fallback - return a basic condition that will work but may not be optimal
        console.warn(`Could not parse predicate: ${predicateStr}. Using fallback condition.`);
        return { condition: '1=1', parameters: [], parsed: false };
    }

    /**
     * Parse a simple condition expression fragment into SQL.
     */
    private parseSimpleCondition(condition: string): { condition: string; parameters: any[] } | null {
        // Handle prop === value
        const equalityMatch = condition.match(/\w+\.(\w+)\s*===?\s*(.+)/);
        if (equalityMatch) {
            const property = equalityMatch[1];
            let value = equalityMatch[2].trim();
            
            // Parse the value properly
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            } else if (!isNaN(Number(value))) {
                value = value;
            }
            
            return {
                condition: `${property} = ?`,
                parameters: [value]
            };
        }

        // Handle prop > value
        const gtMatch = condition.match(/\w+\.(\w+)\s*>\s*(.+)/);
        if (gtMatch) {
            const property = gtMatch[1];
            const value = Number(gtMatch[2]) || gtMatch[2];
            
            return {
                condition: `${property} > ?`,
                parameters: [value]
            };
        }

        // Handle prop >= value
        const gteMatch = condition.match(/\w+\.(\w+)\s*>?=\s*(.+)/);
        if (gteMatch) {
            const property = gteMatch[1];
            const value = Number(gteMatch[2]) || gteMatch[2];
            return { condition: `${property} >= ?`, parameters: [value] };
        }

        // Handle prop < value
        const ltMatch = condition.match(/\w+\.(\w+)\s*<\s*(.+)/);
        if (ltMatch) {
            const property = ltMatch[1];
            const value = Number(ltMatch[2]) || ltMatch[2];
            
            return {
                condition: `${property} < ?`,
                parameters: [value]
            };
        }

        // Handle prop <= value
        const lteMatch = condition.match(/\w+\.(\w+)\s*<=\s*(.+)/);
        if (lteMatch) {
            const property = lteMatch[1];
            const value = Number(lteMatch[2]) || lteMatch[2];
            return { condition: `${property} <= ?`, parameters: [value] };
        }

        return null;
    }

    // whereCompare removed; use `where` for both SQL-eligible and client-side predicates

    /**
     * Extract one or more property names referenced by a selector function string.
     */
    private extractPropertiesFromSelector(selectorStr: string): string[] {
        // Handle single property: p => p.property
        const singleMatch = selectorStr.match(/=>\s*\w+\.(\w+)/);
        if (singleMatch) {
            return [singleMatch[1]];
        }
        
        // Handle object return: p => ({ prop1: p.prop1, prop2: p.prop2 })
        const objectMatch = selectorStr.match(/=>\s*\(\s*\{([^}]+)\}\s*\)/);
        if (objectMatch) {
            const props = objectMatch[1].split(',');
            return props.map(prop => {
                const match = prop.match(/\w+:\s*\w+\.(\w+)/);
                return match ? match[1] : prop.trim();
            });
        }

        // Handle simple object: p => { prop1: p.prop1, prop2: p.prop2 }
        const simpleObjectMatch = selectorStr.match(/=>\s*\{([^}]+)\}/);
        if (simpleObjectMatch) {
            const props = simpleObjectMatch[1].split(',');
            return props.map(prop => {
                const match = prop.match(/\w+:\s*\w+\.(\w+)/) || prop.match(/(\w+)/);
                return match ? match[1] : prop.trim();
            });
        }
        
        return ['*'];
    }

    /**
     * Extract a single property name from a key selector string.
     */
    private extractPropertyFromKeySelector(keySelectorStr: string): string {
        const match = keySelectorStr.match(/=>\s*\w+\.(\w+)/);
        if (match) {
            return match[1];
        }
        throw new Error(`Unable to parse key selector: ${keySelectorStr}`);
    }

    /**
     * Parse a join predicate string into a SQL ON expression.
     */
    private parseJoinCondition(conditionStr: string): string {
        // Enhanced join condition parsing
        // Look for patterns like: (outer, inner) => outer.id === inner.foreignId
        const joinMatch = conditionStr.match(/\((\w+),\s*(\w+)\)\s*=>\s*\1\.(\w+)\s*===?\s*\2\.(\w+)/);
        if (joinMatch) {
            const outerProperty = joinMatch[3];
            const innerProperty = joinMatch[4];
            return `${outerProperty} = ${joinMatch[2]}.${innerProperty}`;
        }
        
        // Fallback to a basic join condition
        return '1=1';
    }

    /**
     * Add eager include using a property selector. Must be called before where/select/...
     */
    public include(selector: (entity: T) => any): QueryBuilder<T> {
        const selectorStr = selector.toString();
        const match = selectorStr.match(/=>\s*\w+\.(\w+)/);
        if (match && match[1]) {
            const prop = match[1];
            if (!this._includes.includes(prop)) {
                this._includes.push(prop);
            }
        }
        return this;
    }

    private mapRowToEntity(row: any): T {
        const entity = new this._entityClass();
        const metadata = MetadataStorage.getEntity(this._entityClass);
        
        if (metadata) {
            // Use metadata to properly map columns to properties
            for (const column of metadata.columns) {
                if (row.hasOwnProperty(column.columnName)) {
                    (entity as any)[column.propertyName] = this.convertValue(row[column.columnName], column.type);
                }
            }
        } else {
            // Fallback: copy all properties
            Object.assign(entity as any, row);
        }
        
        return entity;
    }

    private convertValue(value: any, type: string): any {
        if (value === null || value === undefined) {
            return value;
        }

        switch (type.toUpperCase()) {
            case 'BOOLEAN':
                return Boolean(value);
            case 'INTEGER':
            case 'NUMBER':
                return Number(value);
            case 'DATETIME':
            case 'DATE':
                return new Date(value);
            default:
                return value;
        }
    }
}
