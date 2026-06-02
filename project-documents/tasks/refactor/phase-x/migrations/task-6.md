---
status: not-started
phase: phase-x
package: migrations
priority: P1
effort: S
risk: low
category: package-boundary
depends_on: []
related: ["task-5.md"]
---

# Refactor: Centralize dialect-inspector selection

## Problem

The logic that maps a provider's `providerLabel` to the correct schema inspector is
copy-pasted in two places, each with its own `if (label === 'postgresql') … 'mysql' …
'mssql'` chain plus a per-call inspector instantiation. Adding a dialect or changing
inspector construction means editing every copy, and the duplication has already drifted
(one path defaults unknown providers to "tables exist", the other returns empty indexes).

## Evidence

- `packages/migrations/src/SchemaSnapshot.ts:329-356` — `buildActualFromProvider` defines an
  inner `idxFetch` with the full `postgresql/mysql/mssql` chain, `new XInspector(provider)`
  per call.
- `packages/migrations/src/services/SchemaInspectionService.ts:17-62` — `buildActualSnapshot`
  defines the *same* chain twice: once for `listTables` (17-32) and once for `fetchIndexes`
  (35-62), with a different unknown-provider fallback than `SchemaSnapshot`.
- `packages/migrations/src/SchemaInspector.ts:11,55,100` — the three inspectors
  (`PostgresSchemaInspector`, `MySqlSchemaInspector`, `MssqlSchemaInspector`) are already
  separate classes ready to be selected by a factory.

## Why this is bad

- **DRY violation / drift risk:** three copies of the same dispatch already disagree on the
  unknown-provider fallback.
- **Boundary smell:** dialect knowledge is sprinkled through general builder/service code
  rather than concentrated in one selector.
- **Extensibility:** a new dialect requires edits in multiple methods.

## Target architecture

A single `SchemaInspectorFactory.for(label, provider): SchemaInspector` (Factory) returning
a common `SchemaInspector` interface (`listTables()`, `getIndexes(table)`), with one
explicit policy for unknown providers. Callers depend on the interface, not the concrete
classes (dependency inversion).

## Proposed refactor

1. Define a `SchemaInspector` interface in `SchemaInspector.ts` (the three classes already
   match it structurally).
2. Add `SchemaInspectorFactory.for(label, provider)` returning the right inspector or a
   documented null-object/explicit-error for unknown labels.
3. Replace both dispatch chains in `SchemaSnapshot.buildActualFromProvider` and
   `SchemaInspectionService` with the factory.
4. Decide and document one unknown-provider policy (recommend: explicit
   `UnsupportedDialectError` from task-4 rather than silent empty/assume-exists).

Public API: inspector classes keep their signatures; the factory is additive.

## Suggested design patterns

- **Factory** — single selection point keyed by dialect label. Why: removes duplication;
  one edit per new dialect.
- **Interface segregation** (`SchemaInspector`) — callers depend on the two methods they
  use. Why: testable via fakes.
- **Null Object or explicit error** for unknown dialects. Why: removes the divergent
  silent fallbacks.

## Testing plan

- **Unit:** `SchemaInspectorFactory.for('postgresql'|'mysql'|'mssql')` returns the matching
  inspector; unknown label follows the documented policy.
- **Regression:** `SchemaInspectionService` and `SchemaApplyCommand` paths still produce the
  same actual snapshots for supported dialects.

## Acceptance criteria

- [ ] One `SchemaInspector` interface + one `SchemaInspectorFactory`.
- [ ] Both dispatch chains replaced by the factory.
- [ ] A single, documented unknown-dialect policy (no two divergent fallbacks).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Add interface + factory.
2. Replace the two call sites.
3. Unify the unknown-provider policy.

## Notes

Longer term, consider whether index introspection should live in the dialect packages
(which already own dialect SQL for the query path) rather than being re-implemented here;
record as a follow-up rather than expanding this task's scope.
