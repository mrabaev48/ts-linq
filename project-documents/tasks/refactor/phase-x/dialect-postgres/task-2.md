---
status: completed
phase: phase-x
package: dialect-postgres
priority: P1
effort: L
risk: medium
category: typescript
depends_on: []
related: ['dialect-mssql/task-4.md', 'dialect-mysql/task-1.md']
---

# Refactor: Replace the all-optional SqlDialect interface with an explicit capability model

## Problem
`SqlDialect` declares almost every DML/feature method as **optional**
(`buildInsert?`, `buildUpdate?`, `buildDelete?`, `buildBatch*?`, `buildBulk*?`, `getSpCallSyntax?`).
Providers must therefore guard each call at runtime with `if (!dialect.buildX) throw`, and there is no
single source of truth describing what a dialect actually supports. The type system cannot prove a
required capability is present.

## Evidence
- Optional methods: `packages/types/src/index.ts:271-305` (`SqlDialect`).
- Runtime guards scattered in providers:
  - `packages/provider-postgres/src/PostgresProvider.ts:209,230,303` (`if (!dialect.buildInsert/Update/Delete) throw`).
  - `packages/provider-mysql/src/MySqlProvider.ts:155,200,257` (same pattern).
  - `packages/provider-mssql/src/MssqlProvider.ts:205,235,269` calls `dialect.buildInsert/Update/Delete` **without** a guard — a latent `TypeError` if a dialect omits them (inconsistent with the other providers).
- All three production dialects implement every "optional" method anyway
  (`PostgresDialect.ts:193,217,271,298,324`, etc.), so the optionality is fiction that only weakens types.

## Why this is bad
- Interface Segregation done wrong: optionality is used as a stand-in for capability negotiation.
- Dependency Inversion leak: providers encode dialect knowledge as defensive `if`s instead of relying on a typed contract.
- Inconsistent enforcement (MSSQL provider lacks guards) → latent runtime crash, not a compile error.
- No discoverable feature matrix for consumers writing a new dialect.

## Target architecture
Adopt an explicit **Capabilities object + segregated required interfaces** (Clean Architecture boundary contract):
- Split `SqlDialect` into a **required core** (`buildSelect`, `quoteIdentifier`, `parameterLimit`) plus
  **capability interfaces** (`SupportsCrud`, `SupportsBatch`, `SupportsBulk`, `SupportsStoredProcedures`,
  `SupportsTemporal`).
- Add a `readonly capabilities: DialectCapabilities` flag object (a feature matrix) that the engine/providers
  read once, replacing ad-hoc method-presence checks.
- Provide a typed `requireCapability(dialect, 'crud')` helper that narrows the type (assertion function) so
  downstream code is statically guaranteed the method exists.

## Proposed refactor
1. Define `DialectCapabilities` (boolean matrix) + segregated interfaces in `@ts-linq/types`.
2. Add `requireCrud(dialect): asserts dialect is SqlDialect & SupportsCrud` assertion helpers.
3. Replace the three providers' `if (!dialect.buildX) throw` with a single typed guard call; fix MSSQL's missing guard.
4. Each dialect exposes `capabilities` describing its true matrix (e.g. MSSQL `temporal:true`, PG/MySQL `temporal:false`).

## Suggested design patterns
- **Capability/Feature object** — explicit matrix instead of method-presence sniffing. WHY: discoverable, testable, serializable for tooling.
- **Interface Segregation (SOLID-I)** — small role interfaces composed per dialect. WHY: a keyless/read-only dialect need not fake CRUD.
- **Assertion functions** (`asserts x is T`) — type-narrowing guard. WHY: converts runtime checks into compile-time guarantees at call sites.

## Testing plan
- Type-level tests asserting that consuming `buildInsert` after `requireCrud` compiles without `?.`.
- Unit test each dialect's `capabilities` matches its implemented methods (drives the contract test in task-6).
- Provider tests that a missing capability throws a typed, descriptive error uniformly across all three providers.

## Acceptance criteria
- [x] `DialectCapabilities` + segregated interfaces in `@ts-linq/types`.
- [x] All three providers use the shared typed guard; MSSQL no longer crashes ungracefully.
- [x] Each dialect declares an accurate `capabilities` matrix.
- [x] `pnpm typecheck` passes with no `?.`-style access on guaranteed-present methods.

## Resolution
Implemented as designed, with one deliberate, backward-compatibility-driven deviation: `capabilities`
was added to `SqlDialect` as **optional** (`capabilities?: DialectCapabilities`), not required, and
the pre-existing optional CRUD/batch/bulk/SP methods on `SqlDialect` were **not** removed. Making
`capabilities` (or the methods) required would have broken ~20 unrelated `implements SqlDialect` test
doubles across `core`/`query`/`cli`/`testkits`. The three production dialects
(`PostgresDialect`/`MysqlDialect`/`MssqlDialect`) declare `capabilities` as a required literal field;
the `require*` assertion helpers in `@ts-linq/types/runtime.ts` prefer the declared `capabilities`
flag and fall back to method-presence sniffing when it is absent, so every existing implementer keeps
working unchanged. All three providers (`PostgresProvider`/`MySqlProvider`/`MssqlProvider`) now call
`requireCrud(dialect)` before INSERT/UPDATE/DELETE — MSSQL's missing guard is fixed. Full validation
suite green (typecheck/lint/unit 4190/integration 461/e2e 290/build/arch:deps/cycles/dead).

## Refactor order
1. Types + assertion helpers. 2. Dialect `capabilities`. 3. Provider migration. 4. Contract/type tests.

## Notes
Cross-dialect; the MSSQL provider-guard manifestation is `dialect-mssql/task-4.md`. Touches `@ts-linq/types`
and all provider packages — coordinate as one PR with a changeset (minor: additive, backward compatible if
old optional methods are retained as a deprecated alias).
