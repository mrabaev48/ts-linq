export type SqlParameter = string | number | boolean | Date | Uint8Array | null;
export interface OrderByClause {
    column: string;
    direction: 'ASC' | 'DESC';
}
export interface WhereClause {
    condition: string;
    parameters: readonly SqlParameter[];
}
export interface JoinClause {
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    table: string;
    on: string;
}
export interface QueryOptions {
    select?: string[];
    where?: WhereClause;
    orderBy?: OrderByClause[];
    joins?: JoinClause[];
    groupBy?: string[];
    having?: WhereClause;
    limit?: number;
    offset?: number;
    distinct?: boolean;
    from?: string;
    cte?: {
        name: string;
        sql: string;
    };
}
export interface ColumnOptions {
    name?: string;
    type?: string;
    nullable?: boolean;
    unique?: boolean;
    default?: unknown;
    primaryKey?: boolean;
}
export interface RelationshipOptions {
    targetEntity: () => Function;
    inverseSide?: string;
    cascade?: boolean;
}
export interface Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
export interface SqlDialect {
    buildSelect<T>(entityClass: new () => T, options: QueryOptions): {
        query: string;
        parameters: readonly SqlParameter[];
    };
    quoteIdentifier(identifier: string): string;
}
export interface OrmMiddleware {
    beforeExecute?(sql: string, params: readonly SqlParameter[]): Promise<void> | void;
    afterExecute?(sql: string, result: unknown): Promise<void> | void;
    entityMaterialized?<T>(entity: T): void;
}
export interface RetryPolicy {
    shouldRetry(error: unknown, attempt: number, inTransaction?: boolean): boolean;
    getDelay?(attempt: number): number;
}
export interface ConnectionPoolOptions {
    min?: number;
    max?: number;
    idleTimeoutMs?: number;
}
export interface ConnectionHealthCheckOptions {
    enabled?: boolean;
    intervalMs?: number;
    timeoutMs?: number;
}
export interface SoftDeleteOptions {
    columnName?: string;
    type?: 'boolean' | 'timestamp';
}
export interface CacheOptions {
    ttl?: number;
    maxSize?: number;
}
export type ColumnType = 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB' | 'BOOLEAN' | 'DATE' | 'TIMESTAMP' | string;
export interface ColumnMetadata {
    propertyName: string;
    columnName: string;
    type: ColumnType;
    nullable?: boolean;
    unique?: boolean;
    primaryKey?: boolean;
    default?: unknown;
    defaultValue?: unknown;
    defaultExpression?: string;
    defaultExpressionDialect?: Record<string, string | undefined>;
    computedExpression?: string;
    length?: number;
    precision?: number;
    scale?: number;
    generated?: boolean;
    isGenerated?: boolean;
    isComputed?: boolean;
    version?: boolean;
    isVersion?: boolean;
}
export interface RelationshipMetadata {
    propertyName: string;
    type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
    targetEntity: string | Function | (() => Function);
    foreignKey?: string;
    inverseSide?: string;
    cascade?: boolean;
    through?: string | object;
}
export interface IndexMetadata {
    name: string;
    columns: string[];
    unique?: boolean;
    where?: string;
}
export interface ValidationRule {
    propertyName?: string;
    validator?: (value: unknown, entity: unknown) => boolean;
    message: string;
    predicate?: (value: unknown) => boolean;
    phase?: 'onCreate' | 'onUpdate' | 'always';
    messageKey?: string;
    messageParams?: Record<string, unknown>;
}
export interface EntityMetadata {
    target?: Function;
    className?: string;
    tableName: string;
    columns: ColumnMetadata[];
    relationships: RelationshipMetadata[];
    indexes: IndexMetadata[];
    validationRules?: ValidationRule[];
    validations?: ValidationRule[];
    primaryKeys?: string[];
    primaryKeyColumn?: string;
    schema?: string;
}
export * from './errors';
//# sourceMappingURL=index.d.ts.map