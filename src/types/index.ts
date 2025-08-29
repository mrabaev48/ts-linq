import 'reflect-metadata';

export enum EntityState {
    Unchanged = 'unchanged',
    Added = 'added',
    Modified = 'modified',
    Deleted = 'deleted'
}

export enum LoadingStrategy {
    Lazy = 'lazy',
    Eager = 'eager'
}

export enum JoinType {
    Inner = 'INNER',
    Left = 'LEFT',
    Right = 'RIGHT',
    Full = 'FULL'
}

export interface TrackedEntity {
    entity: any;
    entityClass: Function;
    state: EntityState;
    originalValues?: any;
}

export interface DbContextOptions {
    connectionString: string;
    provider?: 'sqlite' | 'mysql' | 'postgresql';
}

export interface LoadingOptions {
    strategy?: LoadingStrategy;
    includes?: string[];
    depth?: number;
}

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

export interface RelationshipMetadata {
    propertyName: string;
    type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
    targetEntity: Function | (() => Function);
    foreignKey?: string;
    inverseSide?: string;
    cascade?: boolean;
}

export interface IndexMetadata {
    name: string;
    columns: string[];
    unique: boolean;
}

export interface EntityMetadata {
    target: Function;
    tableName: string;
    columns: ColumnMetadata[];
    primaryKeys: string[];
    relationships: RelationshipMetadata[];
    indexes: IndexMetadata[];
}

export interface QueryResult<T> {
    data: T[];
    total?: number;
    page?: number;
    pageSize?: number;
}

export interface AggregateResult {
    [key: string]: any;
}

export interface JoinClause {
    type: JoinType;
    table: string;
    on: string;
    alias?: string;
}

export interface WhereClause {
    condition: string;
    parameters: any[];
}

export interface OrderByClause {
    column: string;
    direction: 'ASC' | 'DESC';
}

export interface GroupByClause {
    columns: string[];
    having?: WhereClause;
}

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
