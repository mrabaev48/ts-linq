import 'reflect-metadata';

/**
 * Core types and metadata contracts used across the ORM.
 */
export enum EntityState {
    Unchanged = 'unchanged',
    Added = 'added',
    Modified = 'modified',
    Deleted = 'deleted'
}

/**
 * Strategy for loading related entities.
 * - Lazy: relationships are not auto-loaded
 * - Eager: relationships are loaded immediately
 */
export enum LoadingStrategy {
    Lazy = 'lazy',
    Eager = 'eager'
}

/**
 * SQL join types supported by the query builder.
 */
export enum JoinType {
    Inner = 'INNER',
    Left = 'LEFT',
    Right = 'RIGHT',
    Full = 'FULL'
}

/**
 * Internal structure representing a tracked entity and its state.
 */
export interface TrackedEntity {
    entity: any;
    entityClass: Function;
    state: EntityState;
    originalValues?: any;
}

/**
 * Options for constructing a database context.
 */
export interface DbContextOptions {
    connectionString: string;
    provider?: 'sqlite' | 'mysql' | 'postgresql';
}

/**
 * Options for controlling entity loading behavior.
 */
export interface LoadingOptions {
    strategy?: LoadingStrategy;
    includes?: string[];
    depth?: number;
}

/**
 * Column configuration stored in entity metadata.
 */
export interface ColumnMetadata {
    propertyName: string;
    columnName: string;
    type: string;
    nullable: boolean;
    defaultValue?: any;
    length?: number;
    precision?: number;
    scale?: number;
    isGenerated?: boolean;
}

/**
 * Relationship configuration stored in entity metadata.
 */
export interface RelationshipMetadata {
    propertyName: string;
    type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
    targetEntity: Function | (() => Function);
    foreignKey?: string;
    inverseSide?: string;
    cascade?: boolean;
}

/**
 * Index definition for an entity.
 */
export interface IndexMetadata {
    name: string;
    columns: string[];
    unique: boolean;
}

/**
 * Full metadata description for an entity type.
 */
export interface EntityMetadata {
    target: Function;
    tableName: string;
    columns: ColumnMetadata[];
    primaryKeys: string[];
    relationships: RelationshipMetadata[];
    indexes: IndexMetadata[];
}

/**
 * Standardized structure for returning query results with optional paging info.
 */
export interface QueryResult<T> {
    data: T[];
    total?: number;
    page?: number;
    pageSize?: number;
}

/**
 * Generic key-value map for aggregate query results.
 */
export interface AggregateResult {
    [key: string]: any;
}

/**
 * Join clause used during SQL generation.
 */
export interface JoinClause {
    type: JoinType;
    table: string;
    on: string;
    alias?: string;
}

/**
 * WHERE clause fragment with parameter list.
 */
export interface WhereClause {
    condition: string;
    parameters: any[];
}

/**
 * ORDER BY clause element.
 */
export interface OrderByClause {
    column: string;
    direction: 'ASC' | 'DESC';
}

/**
 * GROUP BY configuration and optional HAVING condition.
 */
export interface GroupByClause {
    columns: string[];
    having?: WhereClause;
}

/**
 * Accumulated options that define a SQL query to be generated.
 */
export interface QueryOptions {
    select?: string[];
    where?: WhereClause[];
    orderBy?: OrderByClause[];
    groupBy?: GroupByClause;
    joins?: JoinClause[];
    limit?: number;
    offset?: number;
    distinct?: boolean;
}
