/**
 * Core ORM exports - types, decorators, metadata, context, query building,
 * change tracking, loading utilities, and base provider abstractions.
 */
// Core-specific types only (NOT re-exporting from @ts-linq/types)
export { EntityState, CircuitOpenError } from './types';
// Decorators
export * from './decorators/Entity';
export * from './decorators/Column';
export * from './decorators/PrimaryKey';
export * from './decorators/Relationships';
export * from './decorators/ValidIf';
export * from './decorators/CachePolicy';
// Metadata - moved to @ts-linq/metadata package
// Import from: @ts-linq/metadata
// Change tracking - moved to @ts-linq/orm package  
// Import from: @ts-linq/orm
// Context and DbSet - moved to @ts-linq/orm package
// Import from: @ts-linq/orm
// Query building - moved to @ts-linq/query package
// Import from: @ts-linq/query
// Base provider abstractions
export * from './DatabaseProvider';
export * from './DdlStrategy';
export * from './DdlBuilder';
// Loading
export * from './loading/LoadingStrategy';
export * from './loading/EntityLoader';
export * from './loading/LazyLoadingProxy';
// Migrations - moved to @ts-linq/migrations package
// Import from: @ts-linq/migrations
// Utils
export * from './utils/SqlHelper';
export * from './utils/RetryPolicies';
export * from './utils/EntityCache';
// export * from './utils/InternalLogger'; // Removed
export * from './utils/PrometheusEndpoint';
//# sourceMappingURL=index.js.map