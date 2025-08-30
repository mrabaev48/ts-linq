import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { WhereClause, OrderByClause, PerformanceOptions, Result, ok, err } from '../types';
import { QueryBuilder } from './QueryBuilder';
import { PredicateParser } from './PredicateParser';
import { SqlVisitor } from './ast/SqlVisitor';
import { QueryModel } from './QueryModel';
import { EntityLoader } from '../loading/EntityLoader';
import { LoadingStrategy } from '../loading/LoadingStrategy';
import { EntityCache } from '../utils/EntityCache';

/**
 * Fluent query builder over a given entity type. Accumulates query intent
 * in a QueryModel and delegates SQL generation to QueryBuilder.
 */
export class Queryable<T> {
    private _entityClass: new () => T;
    private _provider: DatabaseProvider;
    private _model: QueryModel = new QueryModel();
    private _fallbackPredicates: Array<(entity: T) => boolean> = [];
    private _entityLoader?: EntityLoader;
    private _entityCache?: EntityCache;
    private _performance?: PerformanceOptions;
    private _includes: string[] = [];
    private _sqlBuilder = new QueryBuilder();
    private static _countCache: Map<string, { value: number; ts: number }> = new Map();

    /**
     * Create a new Queryable bound to an entity type and provider.
     * @param entityClass Entity constructor.
     * @param provider Database provider used for execution.
     * @param entityLoader Optional entity loader for eager includes.
     */
    constructor(
        entityClass: new () => T,
        provider: DatabaseProvider,
        entityLoader?: EntityLoader,
        entityCache?: EntityCache,
        performance?: PerformanceOptions
    ) {
        this._entityClass = entityClass;
        this._provider = provider;
        this._entityLoader = entityLoader;
        this._entityCache = entityCache;
        this._performance = performance;
    }

    /**
     * Adds a filter predicate to the query. If the predicate cannot be parsed
     * into SQL, it is stored and applied in-memory after fetching.
     *
     * @example
     * const cheap = await context.products.where(p => p.price < 100).toArray();
     */
    public where(predicate: (entity: T) => boolean): Queryable<T> {
        this.addWhereOrFallback(predicate);
        return this;
    }

    /**
     * Projects selected properties. Returns a new Queryable of the projected type.
     * @param selector Projection selector.
     *
     * @example
     * const names = await context.authors.select(a => a.name).toArray();
     */
    public select<TResult>(selector: (entity: T) => TResult): Queryable<TResult> {
        const next = new Queryable<TResult>(this._entityClass as any, this._provider, this._entityLoader, this._entityCache, this._performance);
        next._model = this._model.clone() as any;
        const selectorStr = selector.toString();
        const properties = this.extractPropertiesFromSelector(selectorStr);
        next._model.select = properties;
        return next;
    }

    /**
     * Adds ASC ordering by key selector.
     * @param keySelector Sort key selector.
     *
     * @example
     * const ordered = await context.books.orderBy(b => b.title).toArray();
     */
    public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        const orderByClause: OrderByClause = { column, direction: 'ASC' };
        this._model.orderBy = this._model.orderBy || [];
        this._model.orderBy.push(orderByClause);
        return this;
    }

    /**
     * Adds DESC ordering by key selector.
     * @param keySelector Sort key selector.
     *
     * @example
     * const latest = await context.books.orderByDescending(b => b.id).take(5).toArray();
     */
    public orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        const orderByClause: OrderByClause = { column, direction: 'DESC' };
        this._model.orderBy = this._model.orderBy || [];
        this._model.orderBy.push(orderByClause);
        return this;
    }

    /** Limits the number of returned rows.
     * @example
     * const top10 = await context.products.take(10).toArray();
     */
    public take(count: number): Queryable<T> { this._model.limit = count; return this; }
    /** Skips given number of rows.
     * @example
     * const page2 = await context.products.orderBy(p => p.id).skip(10).take(10).toArray();
     */
    public skip(count: number): Queryable<T> { this._model.offset = count; return this; }
    /** Ensures distinct rows.
     * @example
     * const titles = await context.books.select(b => b.title).distinct().toArray();
     */
    public distinct(): Queryable<T> { this._model.distinct = true; return this; }

    /**
     * Adds eager-loading of a relationship using a property selector.
     * Validates the relationship against entity metadata.
     *
     * @example
     * const authors = await context.authors.include(a => a.books).where(a => a.id === 1).toArray();
     */
    public include(selector: (entity: T) => any): Queryable<T> {
        const prop = this.extractIncludeProperty(selector);
        const metadata = MetadataStorage.getEntity(this._entityClass);
        const valid = metadata?.relationships.some(r => r.propertyName === prop);
        if (!valid) {
            throw new Error(`Invalid include '${prop}' for ${this._entityClass.name}. Define relationship '${prop}' via decorators or fix the name.`);
        }
        if (!this._includes.includes(prop)) this._includes.push(prop);
        return this;
    }

    /** Executes the query and returns materialized entities.
     * @example
     * const items = await context.products.where(p => p.stock > 0).toArray();
     */
    public async toArray(): Promise<T[]> {
        const sql = this._sqlBuilder.generateFromModel(this._entityClass, this._model);
        const rows = await this._provider.executeQuery<any>(sql.query, sql.parameters);
        let entities = rows.map(r => this.mapRowToEntity(r));
        entities = this.applyFallbackPredicates(entities);
        if (this._entityLoader && this._includes.length > 0) {
            await this._entityLoader.populateRelationshipsMany(entities, this._entityClass, {
                strategy: LoadingStrategy.Eager, includes: this._includes, depth: 1
            });
        }
        return entities;
    }

    /** Returns the first entity or throws if none.
     * @example
     * const first = await context.books.orderBy(b => b.id).first();
     */
    public async first(): Promise<T> {
        const m = this._model.clone();
        m.limit = 1;
        const sql = this._sqlBuilder.generateFromModel(this._entityClass, m);
        const rows = await this._provider.executeQuery<any>(sql.query, sql.parameters);
        let entities = rows.map(r => this.mapRowToEntity(r));
        entities = this.applyFallbackPredicates(entities);
        if (!entities.length) throw new Error('Sequence contains no elements');
        return entities[0];
    }
    /** Try-версия first без исключений. */
    public async tryFirst(): Promise<Result<T, Error>> {
        try {
            const v = await this.first();
            return ok(v);
        } catch (e: any) {
            return err(e);
        }
    }
    /** Returns the first entity or null.
     * @example
     * const maybe = await context.books.where(b => b.id > 10000).firstOrDefault();
     */
    public async firstOrDefault(): Promise<T | null> {
        const m = this._model.clone();
        m.limit = 1;
        const sql = this._sqlBuilder.generateFromModel(this._entityClass, m);
        const rows = await this._provider.executeQuery<any>(sql.query, sql.parameters);
        let entities = rows.map(r => this.mapRowToEntity(r));
        entities = this.applyFallbackPredicates(entities);
        return entities[0] ?? null;
    }
    /** Ensures exactly one result; throws if 0 or more than 1.
     * @example
     * const book = await context.books.where(b => b.id === 1).single();
     */
    public async single(): Promise<T> { const r = await this.toArray(); if (r.length === 0) throw new Error('Sequence contains no elements'); if (r.length > 1) throw new Error('Sequence contains more than one element'); return r[0]; }
    /** Try-версия single без исключений. */
    public async trySingle(): Promise<Result<T, Error>> {
        try {
            const v = await this.single();
            return ok(v);
        } catch (e: any) {
            return err(e);
        }
    }
    /** Returns one or null; throws if more than 1.
     * @example
     * const maybe = await context.books.where(b => b.id === 9999).singleOrDefault();
     */
    public async singleOrDefault(): Promise<T | null> { const r = await this.toArray(); if (r.length > 1) throw new Error('Sequence contains more than one element'); return r[0] ?? null; }
    /** Returns the number of rows that match the current query.
     * @example
     * const count = await context.products.where(p => p.price >= 100).count();
     */
    public async count(): Promise<number> {
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata) throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
        if (this._performance?.enableCountCache) {
            const key = this.buildCountCacheKey(metadata.tableName);
            const ttl = this._performance.countCacheTtlMs ?? 0;
            const hit = Queryable._countCache.get(key);
            if (hit && (ttl <= 0 || (Date.now() - hit.ts) <= ttl)) {
                return hit.value;
            }
            const value = await this.executeCountQuery(metadata.tableName);
            Queryable._countCache.set(key, { value, ts: Date.now() });
            return value;
        }
        return this.executeCountQuery(metadata.tableName);
    }

    private buildCountCacheKey(table: string): string {
        const where = (this._model.where || []).map(w => ({ c: (w as any).condition, p: (w as any).parameters }));
        return `${this._entityClass.name}|count|${table}|${JSON.stringify(where)}`;
    }

    private async executeCountQuery(table: string): Promise<number> {
        let query = `SELECT COUNT(*) as count FROM ${table}`;
        let parameters: any[] = [];
        if (this._model.where && this._model.where.length > 0) {
            const whereClauses = this._model.where.map(w => (w as any).condition);
            query += ` WHERE ${whereClauses.join(' AND ')}`;
            for (const where of this._model.where) parameters.push(...(where as any).parameters);
        }
        const results = await this._provider.executeQuery<{ count: number }>(query, parameters);
        return results[0]?.count ?? 0;
    }
    /** Returns true if at least one row matches the query.
     * @example
     * const exists = await context.products.where(p => p.name === 'Laptop').any();
     */
    public async any(): Promise<boolean> {
        const m = this._model.clone();
        m.limit = 1;
        const sql = this._sqlBuilder.generateFromModel(this._entityClass, m);
        const rows = await this._provider.executeQuery<any>(sql.query, sql.parameters);
        let entities = rows.map(r => this.mapRowToEntity(r));
        entities = this.applyFallbackPredicates(entities);
        return entities.length > 0;
    }

    // helpers copied from previous QueryBuilder for parsing
    /** Adds a SQL where clause if possible, else stores predicate for in-memory filtering. */
    private addWhereOrFallback(predicate: (entity: T) => boolean): void {
        const parser = new PredicateParser<T>();
        const ast = parser.parse(predicate);
        if (ast) {
            const visitor = new SqlVisitor();
            const { condition, parameters } = visitor.toSql(ast);
            const whereClause: WhereClause = { condition: condition as any, parameters: parameters as any } as any;
            this._model.where = this._model.where || [];
            this._model.where.push(whereClause);
        } else {
            this._fallbackPredicates.push(predicate);
        }
    }

    /** Applies all stored fallback predicates (runtime filters). */
    private applyFallbackPredicates(entities: T[]): T[] {
        if (this._fallbackPredicates.length === 0) return entities;
        let result = entities;
        for (const pred of this._fallbackPredicates) {
            result = result.filter(e => { try { return pred(e); } catch { return false; } });
        }
        return result;
    }

    /** Extracts include property name from a lambda selector. */
    private extractIncludeProperty(selector: (entity: T) => any): string {
        const selectorStr = selector.toString();
        const match = selectorStr.match(/=>\s*\w+\.(\w+)/);
        if (match && match[1]) return match[1];
        throw new Error(`Unable to parse include selector: ${selectorStr}`);
    }

    /**
     * Extract property names from a projection selector function string.
     * Supports single property, object destructuring, and simple object literal forms.
     */
    private extractPropertiesFromSelector(selectorStr: string): string[] {
        const singleMatch = selectorStr.match(/=>\s*\w+\.(\w+)/);
        if (singleMatch) return [singleMatch[1]];
        const objectMatch = selectorStr.match(/=>\s*\(\s*\{([^}]+)\}\s*\)/);
        if (objectMatch) { const props = objectMatch[1].split(','); return props.map(prop => { const match = prop.match(/\w+:\s*\w+\.(\w+)/); return match ? match[1] : prop.trim(); }); }
        const simpleObjectMatch = selectorStr.match(/=>\s*\{([^}]+)\}/);
        if (simpleObjectMatch) { const props = simpleObjectMatch[1].split(','); return props.map(prop => { const match = prop.match(/\w+:\s*\w+\.(\w+)/) || prop.match(/(\w+)/); return match ? match[1] : prop.trim(); }); }
        return ['*'];
    }

    /**
     * Extract a single property name from a key selector function string.
     * Throws if parsing fails.
     */
    private extractPropertyFromKeySelector(keySelectorStr: string): string {
        const match = keySelectorStr.match(/=>\s*\w+\.(\w+)/);
        if (match) return match[1];
        throw new Error(`Unable to parse key selector: ${keySelectorStr}`);
    }

    /**
     * Map a raw database row object to a new entity instance using metadata.
     * Falls back to shallow assign when no metadata is available.
     */
    private mapRowToEntity(row: any): T {
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (this._performance?.enableEntityCache && this._entityCache && metadata && metadata.primaryKeys.length > 0) {
            const pkProp = metadata.primaryKeys[0];
            const pkCol = metadata.columns.find(c => c.propertyName === pkProp);
            const idValue = pkCol ? row[pkCol.columnName] : row[pkProp as any];
            const cached = this._entityCache.get<T>(this._entityClass, idValue);
            if (cached) return cached;
            const entity = new this._entityClass();
            for (const column of metadata.columns) {
                if (row.hasOwnProperty(column.columnName)) {
                    (entity as any)[column.propertyName] = this.convertValue(row[column.columnName], column.type);
                }
            }
            this._entityCache.set(this._entityClass, idValue, entity);
            return entity;
        }
        const entity = new this._entityClass();
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
    /**
     * Convert a primitive DB value to a runtime value according to column type.
     */
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


