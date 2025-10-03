/**
 * Core ORM exports - types, decorators, metadata, context, query building,
 * change tracking, loading utilities, and base provider abstractions.
 */

// Core types
export * from './types';
export * from './types/Logger';

// Decorators
export * from './decorators/Entity';
export * from './decorators/Column';
export * from './decorators/PrimaryKey';
export * from './decorators/Relationships';
export * from './decorators/ValidIf';

// Metadata
export * from './metadata/MetadataStorage';
export * from './metadata/EntityMetadata';

// Change tracking
export * from './change-tracking/ChangeTracker';

// Context and DbSet
export * from './context/DbContext';
export * from './context/DbSet';

// Query building
export * from './query/Queryable';
export * from './query/TypedQueryable';
export * from './query/QueryBuilder';
export * from './query/SqlCache';
export * from './query/EnhancedSqlCache';
export * from './query/SqlDialect';
export * from './query/CountCache';
export * from './query/GlobalFilterApplier';
export * from './query/JoinPredicateParser';
export * from './query/QueryModel';
export * from '@ts-linq/ast';
export * from './query/ast/SqlVisitor';
export * from './query/SqlFunctions';

// Base provider abstractions
export * from './DatabaseProvider';
export * from './DdlStrategy';
export * from './DdlBuilder';

// Loading
export * from './loading/LoadingStrategy';
export * from './loading/EntityLoader';
export * from './loading/LazyLoadingProxy';

// Migrations
export * from './migrations/Migration';
export * from './migrations/MigrationRunner';
export * from './migrations/DiffTypes';
export * from './migrations/DialectMigrationSql';
export * from './migrations/MigrationBuilder';
export * from './migrations/DiffBasedMigration';
export * from './migrations/MigrationFileBuilder';
export * from './migrations/DiffMigrationGenerator';
export * from './migrations/SchemaSnapshot';

// Utils
export * from './utils/SqlHelper';
export * from './utils/RetryPolicies';
export * from './utils/EntityCache';
