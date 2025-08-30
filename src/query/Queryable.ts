import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { JoinType, WhereClause, OrderByClause, GroupByClause, QueryOptions } from '../types';
import { QueryBuilder } from './QueryBuilder';
import { PredicateParser } from './PredicateParser';
import { SqlVisitor } from './ast/SqlVisitor';
import { QueryModel } from './QueryModel';

export class Queryable<T> {
    private _entityClass: new () => T;
    private _provider: DatabaseProvider;
    private _model: QueryModel = new QueryModel();
    private _fallbackPredicates: Array<(entity: T) => boolean> = [];
    private _entityLoader?: any;
    private _includes: string[] = [];
    private _sqlBuilder = new QueryBuilder();

    constructor(entityClass: new () => T, provider: DatabaseProvider, entityLoader?: any) {
        this._entityClass = entityClass;
        this._provider = provider;
        this._entityLoader = entityLoader;
    }

    public where(predicate: (entity: T) => boolean): Queryable<T> {
        const parser = new PredicateParser<T>();
        const ast = parser.parse(predicate);
        if (ast) {
            const visitor = new SqlVisitor();
            const { condition, parameters } = visitor.toSql(ast);
            const whereClause: WhereClause = { condition: condition as any, parameters: parameters as any } as any;
            this._model.where = this._model.where || [];
            this._model.where.push(whereClause);
        } else {
            // fallback to runtime filtering
            this._fallbackPredicates.push(predicate);
        }
        return this;
    }

    public select<TResult>(selector: (entity: T) => TResult): Queryable<TResult> {
        const next = new Queryable<TResult>(this._entityClass as any, this._provider, this._entityLoader);
        next._model = this._model.clone() as any;
        const selectorStr = selector.toString();
        const properties = this.extractPropertiesFromSelector(selectorStr);
        next._model.select = properties;
        return next;
    }

    public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        const orderByClause: OrderByClause = { column, direction: 'ASC' };
        this._model.orderBy = this._model.orderBy || [];
        this._model.orderBy.push(orderByClause);
        return this;
    }

    public orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        const orderByClause: OrderByClause = { column, direction: 'DESC' };
        this._model.orderBy = this._model.orderBy || [];
        this._model.orderBy.push(orderByClause);
        return this;
    }

    public take(count: number): Queryable<T> { this._model.limit = count; return this; }
    public skip(count: number): Queryable<T> { this._model.offset = count; return this; }
    public distinct(): Queryable<T> { this._model.distinct = true; return this; }

    public include(selector: (entity: T) => any): Queryable<T> {
        const selectorStr = selector.toString();
        const match = selectorStr.match(/=>\s*\w+\.(\w+)/);
        if (match && match[1]) {
            const prop = match[1];
            // Validate include name against metadata
            const metadata = MetadataStorage.getEntity(this._entityClass);
            const valid = metadata?.relationships.some(r => r.propertyName === prop);
            if (!valid) {
                throw new Error(`Invalid include '${prop}' for ${this._entityClass.name}. Define relationship '${prop}' via decorators or fix the name.`);
            }
            if (!this._includes.includes(prop)) this._includes.push(prop);
        }
        return this;
    }

    public async toArray(): Promise<T[]> {
        const sql = this._sqlBuilder.generateFromModel(this._entityClass, this._model);
        const rows = await this._provider.executeQuery<any>(sql.query, sql.parameters);
        let entities = rows.map(r => this.mapRowToEntity(r));
        if (this._fallbackPredicates.length > 0) {
            for (const pred of this._fallbackPredicates) {
                entities = entities.filter(e => { try { return pred(e); } catch { return false; } });
            }
        }
        if (this._entityLoader && this._includes.length > 0) {
            await this._entityLoader.populateRelationshipsMany(entities, this._entityClass, {
                strategy: 'eager', includes: this._includes, depth: 1
            });
        }
        return entities;
    }

    public async first(): Promise<T> { this._model.limit = 1; const r = await this.toArray(); if (!r.length) throw new Error('Sequence contains no elements'); return r[0]; }
    public async firstOrDefault(): Promise<T | null> { this._model.limit = 1; const r = await this.toArray(); return r[0] ?? null; }
    public async single(): Promise<T> { const r = await this.toArray(); if (r.length === 0) throw new Error('Sequence contains no elements'); if (r.length > 1) throw new Error('Sequence contains more than one element'); return r[0]; }
    public async singleOrDefault(): Promise<T | null> { const r = await this.toArray(); if (r.length > 1) throw new Error('Sequence contains more than one element'); return r[0] ?? null; }
    public async count(): Promise<number> {
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata) throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
        let query = `SELECT COUNT(*) as count FROM ${metadata.tableName}`;
        let parameters: any[] = [];
        if (this._model.where && this._model.where.length > 0) {
            const whereClauses = this._model.where.map(w => (w as any).condition);
            query += ` WHERE ${whereClauses.join(' AND ')}`;
            for (const where of this._model.where) parameters.push(...(where as any).parameters);
        }
        const results = await this._provider.executeQuery<{ count: number }>(query, parameters);
        return results[0].count;
    }
    public async any(): Promise<boolean> { this._model.limit = 1; const r = await this.toArray(); return r.length > 0; }

    // helpers copied from previous QueryBuilder for parsing
    private parsePredicateToSql(predicateStr: string): { condition: string; parameters: any[]; parsed: boolean } {
        const equalityMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*===?\s*(.+)/);
        if (equalityMatch) {
            const property = equalityMatch[2];
            let value = equalityMatch[3].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
                return { condition: `${property} = ?`, parameters: [value], parsed: true };
            }
            const asNumber = Number(value);
            if (!Number.isNaN(asNumber)) return { condition: `${property} = ?`, parameters: [asNumber], parsed: true };
            return { condition: '1=1', parameters: [], parsed: false };
        }
        const gtMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*>\s*(.+)/);
        if (gtMatch) { const property = gtMatch[2]; const num = Number(gtMatch[3]); if (!Number.isNaN(num)) return { condition: `${property} > ?`, parameters: [num], parsed: true }; return { condition: '1=1', parameters: [], parsed: false }; }
        const gteMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*>?=\s*(.+)/);
        if (gteMatch) { const property = gteMatch[2]; const num = Number(gteMatch[3]); if (!Number.isNaN(num)) return { condition: `${property} >= ?`, parameters: [num], parsed: true }; return { condition: '1=1', parameters: [], parsed: false }; }
        const ltMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*<\s*(.+)/);
        if (ltMatch) { const property = ltMatch[2]; const num = Number(ltMatch[3]); if (!Number.isNaN(num)) return { condition: `${property} < ?`, parameters: [num], parsed: true }; return { condition: '1=1', parameters: [], parsed: false }; }
        const lteMatch = predicateStr.match(/(\w+)\s*=>\s*\w+\.(\w+)\s*<=\s*(.+)/);
        if (lteMatch) { const property = lteMatch[2]; const num = Number(lteMatch[3]); if (!Number.isNaN(num)) return { condition: `${property} <= ?`, parameters: [num], parsed: true }; return { condition: '1=1', parameters: [], parsed: false }; }
        const compoundMatch = predicateStr.match(/(\w+)\s*=>\s*(.+)/);
        if (compoundMatch && compoundMatch[2].includes('&&')) {
            const parts = compoundMatch[2].split('&&');
            const conditions: string[] = [];
            const parameters: any[] = [];
            for (const part of parts) {
                const result = this.parseSimpleCondition(part.trim());
                if (result) { conditions.push(result.condition); parameters.push(...result.parameters); }
            }
            if (conditions.length > 0) return { condition: conditions.join(' AND '), parameters, parsed: true };
        }
        return { condition: '1=1', parameters: [], parsed: false };
    }

    private parseSimpleCondition(condition: string): { condition: string; parameters: any[] } | null {
        const equalityMatch = condition.match(/\w+\.(\w+)\s*===?\s*(.+)/);
        if (equalityMatch) { const property = equalityMatch[1]; let value = equalityMatch[2].trim(); if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) { value = value.slice(1, -1); } else if (!isNaN(Number(value))) { value = value; } return { condition: `${property} = ?`, parameters: [value] }; }
        const gtMatch = condition.match(/\w+\.(\w+)\s*>\s*(.+)/);
        if (gtMatch) { const property = gtMatch[1]; const value = Number(gtMatch[2]) || gtMatch[2]; return { condition: `${property} > ?`, parameters: [value] }; }
        const gteMatch = condition.match(/\w+\.(\w+)\s*>?=\s*(.+)/);
        if (gteMatch) { const property = gteMatch[1]; const value = Number(gteMatch[2]) || gteMatch[2]; return { condition: `${property} >= ?`, parameters: [value] }; }
        const ltMatch = condition.match(/\w+\.(\w+)\s*<\s*(.+)/);
        if (ltMatch) { const property = ltMatch[1]; const value = Number(ltMatch[2]) || ltMatch[2]; return { condition: `${property} < ?`, parameters: [value] }; }
        const lteMatch = condition.match(/\w+\.(\w+)\s*<=\s*(.+)/);
        if (lteMatch) { const property = lteMatch[1]; const value = Number(lteMatch[2]) || lteMatch[2]; return { condition: `${property} <= ?`, parameters: [value] }; }
        return null;
    }

    private extractPropertiesFromSelector(selectorStr: string): string[] {
        const singleMatch = selectorStr.match(/=>\s*\w+\.(\w+)/);
        if (singleMatch) return [singleMatch[1]];
        const objectMatch = selectorStr.match(/=>\s*\(\s*\{([^}]+)\}\s*\)/);
        if (objectMatch) { const props = objectMatch[1].split(','); return props.map(prop => { const match = prop.match(/\w+:\s*\w+\.(\w+)/); return match ? match[1] : prop.trim(); }); }
        const simpleObjectMatch = selectorStr.match(/=>\s*\{([^}]+)\}/);
        if (simpleObjectMatch) { const props = simpleObjectMatch[1].split(','); return props.map(prop => { const match = prop.match(/\w+:\s*\w+\.(\w+)/) || prop.match(/(\w+)/); return match ? match[1] : prop.trim(); }); }
        return ['*'];
    }

    private extractPropertyFromKeySelector(keySelectorStr: string): string {
        const match = keySelectorStr.match(/=>\s*\w+\.(\w+)/);
        if (match) return match[1];
        throw new Error(`Unable to parse key selector: ${keySelectorStr}`);
    }

    private mapRowToEntity(row: any): T {
        const entity = new this._entityClass();
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (metadata) {
            for (const column of metadata.columns) {
                if (row.hasOwnProperty(column.columnName)) {
                    (entity as any)[column.propertyName] = this.convertValue(row[column.columnName], column.type);
                }
            }
        } else {
            Object.assign(entity as any, row);
        }
        return entity;
    }
    private convertValue(value: any, type: string): any {
        if (value == null) return value;
        switch (type.toUpperCase()) {
            case 'BOOLEAN': return Boolean(value);
            case 'INTEGER': case 'NUMBER': return Number(value);
            case 'DATETIME': case 'DATE': return new Date(value);
            default: return value;
        }
    }
}


