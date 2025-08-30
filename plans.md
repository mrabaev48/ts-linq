# Improvement Plans

## Architecture & OOP
- [done] Introduce SQL Dialect Strategy (SQLiteStrategy, PostgresStrategy, MySQLStrategy) and inject into QueryBuilder
- [done] Predicate → AST + Visitor: parse where/select/join into AST; generate SQL via Visitor per dialect (minimal for where)
- [done] Specification pattern for reusable filters (composable specs with toSql()/test())
- [done] Query Object: keep intent (AST/options) separate from execution/mapping services (QueryModel)
- [done] Template Method in providers for connection/execute/map hooks

## Clean Code & Typing
- Remove all implicit any, add strict types for EntityLoader, DbSetWithIncludes, include lists, AST nodes
- Mark read-only data (metadata, options snapshots) as immutable; return new objects when chaining
- Replace operator strings with enums (ComparisonOperator, LogicalOperator)
- Extract long methods in Queryable into small private helpers
- Strengthen JSDoc with parameter/return types and invariants

## Performance
- [done] Anti N+1: batch one-to-many loading using IN queries per relation (per request)
- Add per-query SQL generation cache (hash of options → {query, params})
- Level-2 cache for row→entity mapping (optional, behind flag)
- Optional pagination total count optimization (COUNT window caching)

## Reliability & Errors
- Optional Result<T, E> for non-exceptional flows; centralize error mapping
- Central SQL logger with timings, parameters (safe), transaction trace ids
- Safer predicate parser: guard rails and deterministic fallbacks

## API & DX
- [done] Validate include names against metadata; descriptive errors
- Configurable default depth and strategy at DbContext level; override per call
- Add typed join helpers: innerJoin/leftJoin with selectors
- Provide cancelable/abortable query execution (AbortSignal)

## Testing
- Unit: AST builder, SQL visitor, predicate parser
- Integration: providers contract tests shared across dialects
- Property-based tests (fast-check) for predicate equivalence
- Performance regression tests for include batching

## Documentation & Tooling
- Typedoc API reference from JSDoc
- Guides: anti-N+1 include (batching), custom dialect strategy, specs examples
- Add playground examples: dynamic filters, include-first chaining, joins

## Near-term actionable items
- [done] Implement include batching (one-to-many via IN) in EntityLoader
- [done] Introduce ComparisonOperator enum and refactor parser to use it internally
- Add SQL generation cache in QueryBuilder (simple Map with option hash)
- [done] Validate includes at runtime against metadata and throw clear errors
- [done] Add unit tests for new enum + parser paths, and integration tests for batched includes
