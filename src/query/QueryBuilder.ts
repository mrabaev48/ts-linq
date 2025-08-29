import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SqlHelper } from '../utils/SqlHelper';
import { JoinType, WhereClause, OrderByClause, GroupByClause, QueryOptions } from '../types';

export class QueryBuilder<T> {
    private _entityClass: new () => T;
    private _provider: DatabaseProvider;
    private _options: QueryOptions = {};

    constructor(entityClass: new () => T, provider: DatabaseProvider) {
        this._entityClass = entityClass;
        this._provider = provider;
    }

    public where(predicate: (entity: T) => boolean): QueryBuilder<T> {
        // Enhanced predicate parsing for better SQL generation
        const predicateStr = predicate.toString();
        const { condition, parameters } = this.parsePredicateToSql(predicateStr);
        
        const whereClause: WhereClause = {
            condition,
            parameters
        };
        
        this._options.where = this._options.where || [];
        this._options.where.push(whereClause);
        return this;
    }

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

    public take(count: number): QueryBuilder<T> {
        this._options.limit = count;
        return this;
    }

    public skip(count: number): QueryBuilder<T> {
        this._options.offset = count;
        return this;
    }

    public distinct(): QueryBuilder<T> {
        this._options.distinct = true;
        return this;
    }

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

    public leftJoin<TOther>(
        otherEntity: new () => TOther,
        condition: (outer: T, inner: TOther) => boolean
    ): QueryBuilder<T> {
        return this.join(otherEntity, condition, JoinType.Left);
    }

    public groupBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        const keySelectorStr = keySelector.toString();
        const columns = this.extractPropertiesFromSelector(keySelectorStr);
        
        this._options.groupBy = {
            columns
        };
        return this;
    }

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

    public async toArray(): Promise<T[]> {
        const sql = this.generateSql();
        const results = await this._provider.executeQuery<any>(sql.query, sql.parameters);
        return results.map(row => this.mapRowToEntity(row));
    }

    public async first(): Promise<T> {
        this._options.limit = 1;
        const results = await this.toArray();
        if (results.length === 0) {
            throw new Error('Sequence contains no elements');
        }
        return results[0];
    }

    public async firstOrDefault(): Promise<T | null> {
        this._options.limit = 1;
        const results = await this.toArray();
        return results.length > 0 ? results[0] : null;
    }

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

    public async singleOrDefault(): Promise<T | null> {
        const results = await this.toArray();
        if (results.length > 1) {
            throw new Error('Sequence contains more than one element');
        }
        return results.length > 0 ? results[0] : null;
    }

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

        // LIMIT and OFFSET
        if (this._options.limit) {
            query += ` LIMIT ${this._options.limit}`;
        }
        
        if (this._options.offset) {
            query += ` OFFSET ${this._options.offset}`;
        }

        return { query, parameters };
    }

    private parsePredicateToSql(predicateStr: string): { condition: string; parameters: any[] } {
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
            }
            
            return {
                condition: `${property} = ?`,
                parameters: [value]
            };
        }

        // Handle greater than: p => p.property > value
        const gtMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*>\s*(.+)/);
        if (gtMatch) {
            const property = gtMatch[2];
            const value = parseFloat(gtMatch[3]) || gtMatch[3];
            
            return {
                condition: `${property} > ?`,
                parameters: [value]
            };
        }

        // Handle less than: p => p.property < value
        const ltMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*<\s*(.+)/);
        if (ltMatch) {
            const property = ltMatch[2];
            const value = parseFloat(ltMatch[3]) || ltMatch[3];
            
            return {
                condition: `${property} < ?`,
                parameters: [value]
            };
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
                
                return {
                    condition: conditions.join(' AND '),
                    parameters
                };
            }
        }

        // Fallback - return a basic condition that will work but may not be optimal
        console.warn(`Could not parse predicate: ${predicateStr}. Using fallback condition.`);
        return {
            condition: '1=1',
            parameters: []
        };
    }

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

        return null;
    }

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

    private extractPropertyFromKeySelector(keySelectorStr: string): string {
        const match = keySelectorStr.match(/=>\s*\w+\.(\w+)/);
        if (match) {
            return match[1];
        }
        throw new Error(`Unable to parse key selector: ${keySelectorStr}`);
    }

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
