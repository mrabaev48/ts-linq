---
status: not-started
phase: phase-x
package: core
priority: P0
effort: M
risk: critical
category: sql
depends_on: []
related: ['core/task-9.md']
---

# Refactor: Eliminate raw, string-interpolated SQL with potential injection in `RelationshipLoader`

## Problem
`RelationshipLoader` (in the *generic* `@ts-linq/core` package) builds SQL by string
interpolation of identifiers (junction table name, source/target FK column names)
straight into the query text. These identifiers originate from relationship metadata
(`through.table`, `through.sourceFk`, `through.targetFk`) which can be developer- or
even scaffolding-supplied. This is both a **SQL-injection surface** and a **dialect leak**:
hand-written SQL with `?` placeholders and unquoted identifiers lives in a package that
is supposed to be provider-agnostic.

## Evidence
- `packages/core/src/loading/RelationshipLoader.ts:261-266` (`fetchJunctionMappings`):
  ```ts
  `SELECT ${sourceFk} as s, ${targetFk} as t FROM ${junctionTable} WHERE ${sourceFk} IN (${sourceIds.map(() => '?').join(',')})`
  ```
- `packages/core/src/loading/RelationshipLoader.ts:284-287` (`fetchTargetIdsFromJunction`):
  ```ts
  `SELECT ${targetFk} as id FROM ${junctionTable} WHERE ${sourceFk} = ?`
  ```
- Identifiers (`junctionTable`, `sourceFk`, `targetFk`) are interpolated unquoted and unvalidated.

## Why this is bad
- **Runtime/security risk**: unquoted identifier interpolation is the classic SQL-injection vector; a malicious or mistaken junction config can break out of the identifier position.
- **Dialect risk**: identifier quoting (`"col"` vs `` `col` `` vs `[col]`) differs per provider; this hard-codes none, so it relies on identifiers happening to need no quoting.
- **Boundary violation**: the generic `core` package emits SQL text — that responsibility belongs to the dialect/SQL-generation layer (consistent with the AST package staying pure).

## Target architecture
The junction read must go through the provider's dialect-aware SQL generation rather than
string concatenation in core. Either (a) add a typed provider capability
`queryJunction(spec: JunctionQuerySpec)` that the dialect implements with proper identifier
quoting + parameterization, or (b) express the junction read as an AST `RawSqlNode`/select
node built by the query layer. Apply Ports-and-Adapters: core depends on a capability port,
each provider supplies the dialect-correct adapter.

## Proposed refactor
1. Define `interface JunctionQuerySpec { table: string; selectColumns: string[]; whereColumn: string; whereValues: SqlParameter[]; }`.
2. Add `provider.queryJunction(spec): Promise<Record<string,unknown>[]>` (default impl can quote via a `SqlDialect.quoteIdentifier` helper — verify `SqlDialect` in `@ts-linq/types:271` exposes identifier quoting; if not, add it).
3. Replace the two interpolated queries in `RelationshipLoader` with `provider.queryJunction(...)`.
4. Add identifier validation (reject identifiers not matching `^[A-Za-z_][A-Za-z0-9_]*$`) as defense-in-depth, throwing a typed error.
5. Tests: provider-dialect tests asserting correct quoting per dialect + an injection-attempt test.

## Suggested design patterns
- **Capability / Port-and-Adapter** — `queryJunction` is a provider capability; dialects adapt.
- **Strategy** — per-dialect identifier quoting.
- **Specification** — `JunctionQuerySpec` describes the read declaratively.
- **Guard clause / Result-Either** — identifier validation returns a typed failure rather than emitting unsafe SQL.

## Testing plan
- Provider-dialect: junction query renders with correctly quoted identifiers for postgres/mysql/mssql.
- Error-path: an identifier with a space/quote is rejected with a typed error (not silently interpolated).
- Regression: existing many-to-many loading integration tests pass.

## Acceptance criteria
- [ ] No string-interpolated identifiers in `RelationshipLoader` SQL.
- [ ] Junction reads go through a dialect-aware provider capability.
- [ ] Identifiers are validated/quoted; an injection test fails closed.
- [ ] Cluster validations pass.

## Refactor order
High priority, can land before the larger loader split (`core/task-3`) since it is self-contained. Coordinate with `core/task-9` if both rewrite the junction methods.

## Notes
This is the only raw-SQL emission found in the cluster's generic packages — the AST package is clean (pure node definitions, no SQL strings), and spatial code in core does not emit WKT/SQL. Fixing this keeps the "core is provider-agnostic" invariant intact.
