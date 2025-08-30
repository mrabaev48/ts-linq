# Improvement Plans

## Architecture & OOP
- [done] Introduce SQL Dialect Strategy (SQLiteStrategy, PostgresStrategy, MySQLStrategy) and inject into QueryBuilder
- [done] Predicate → AST + Visitor: parse where/select/join into AST; generate SQL via Visitor per dialect (minimal for where)
- [done] Specification pattern for reusable filters (composable specs with toSql()/test())
- [done] Query Object: keep intent (AST/options) separate from execution/mapping services (QueryModel)
- [done] Template Method in providers for connection/execute/map hooks

## Clean Code & Typing
- [done] Remove all implicit any, add strict types for EntityLoader, DbSetWithIncludes, include lists, AST nodes
- [done] Mark read-only data (metadata, options snapshots) as immutable; return new objects when chaining
- [done] Replace operator strings with enums (ComparisonOperator, LogicalOperator)
- [done] Extract long methods in Queryable into small private helpers
- [done] Strengthen JSDoc with parameter/return types and invariants

## Performance
- [done] Anti N+1: batch one-to-many loading using IN queries per relation (per request)
- [done] Add per-query SQL generation cache (hash of options → {query, params})
- [done] Level-2 cache for row→entity mapping (optional, behind flag)
- [done] Optional pagination total count optimization (COUNT window caching)

## Reliability & Errors
- [done] Optional Result<T, E> for non-exceptional flows; centralize error mapping
- [done] Central SQL logger with timings, parameters (safe), transaction trace ids
- [done] Safer predicate parser: guard rails and deterministic fallbacks

## API & DX
- [done] Validate include names against metadata; descriptive errors
- Configurable default depth and strategy at DbContext level; override per call
- Add typed join helpers: innerJoin/leftJoin with selectors
- Provide cancelable/abortable query execution (AbortSignal)

## Testing
- [done] Unit: AST builder, SQL visitor, predicate parser
- Integration: providers contract tests shared across dialects
- Property-based tests (fast-check) for predicate equivalence
- Performance regression tests for include batching

## Documentation & Tooling
- [done] Typedoc API reference from JSDoc
- [done] Guides: anti-N+1 include (batching), custom dialect strategy, specs examples
- [done] Add playground examples: dynamic filters, include-first chaining, joins
 - [done] Update README with try-methods, SqlLogger, and QueryBuilder cache utilities

## Near-term actionable items
- [done] Implement include batching (one-to-many via IN) in EntityLoader
- [done] Introduce ComparisonOperator enum and refactor parser to use it internally
- [done] Add SQL generation cache in QueryBuilder (simple Map with option hash)
- [done] Validate includes at runtime against metadata and throw clear errors
- [done] Add unit tests for new enum + parser paths, and integration tests for batched includes
