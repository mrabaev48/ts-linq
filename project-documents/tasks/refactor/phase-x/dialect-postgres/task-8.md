---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P2
effort: M
risk: low
category: package-boundary
depends_on: []
related: ['dialect-postgres/task-1.md', 'dialect-postgres/task-7.md']
---

# Refactor: Remove dead chunk*Batch exports, deduplicate the OptionsBuilder, and fix dialect→core/metadata coupling

## Problem
Three smaller boundary/dead-code issues cut across the cluster:
1. `chunkMssqlBatch` / `chunkMysqlBatch` / `chunkPgBatch` are exported from each `batch-syntax` but are never
   imported anywhere in the monorepo — dead public exports.
2. `MssqlOptionsBuilder`, `MysqlOptionsBuilder`, `PostgresOptionsBuilder` are 100% identical except for
   doc-comments — pure duplication of a trivial builder.
3. The dialect packages import from `@ts-linq/core` (`SqlHelper`, `DatabaseProvider`) and `@ts-linq/metadata`
   (`MetadataStorage`), which is a layering/dependency-direction smell: a low-level SQL emitter reaching into
   the provider/runtime layer and performing global metadata lookups.

## Evidence
1. Dead exports (only definitions, zero call sites):
   - `packages/dialect-postgres/src/batch-syntax.ts:167` `export function chunkPgBatch`.
   - `packages/dialect-mssql/src/batch-syntax.ts:159` `export function chunkMssqlBatch`.
   - `packages/dialect-mysql/src/batch-syntax.ts:142` `export function chunkMysqlBatch`.
   Grep across `packages/**/*.ts` (excluding dist/node_modules) finds no importer — chunking is done elsewhere
   (the ORM `BatchExecutor`). Candidates for `arch:dead`.
2. Identical OptionsBuilders:
   - `packages/dialect-mssql/src/MssqlOptionsBuilder.ts:10`, `packages/dialect-mysql/src/MysqlOptionsBuilder.ts`,
     `packages/dialect-postgres/src/PostgresOptionsBuilder.ts:10` — same `_maxBatchSize` field, `maxBatchSize()`,
     `build()`.
3. Dependency-direction:
   - `packages/dialect-mssql/src/MssqlDdlStrategy.ts:1` `import { SqlHelper } from '@ts-linq/core'` (also PG/MySQL DDL).
   - `packages/dialect-*/src/introspector.ts:1` `import type { DatabaseProvider } from '@ts-linq/core'`.
   - `packages/dialect-*/src/*Dialect.ts:1` `import { MetadataStorage } from '@ts-linq/metadata'` and
     `MetadataStorage.getEntity(entityClass)` inside `buildSelect` (`PostgresDialect.ts:98`, `MssqlDialect.ts:91`,
     `MysqlDialect.ts:92`).

## Why this is bad
- Dead exports are part of the public surface (each `index.ts` does `export * from './batch-syntax'`), so they
  appear in published types and confuse consumers; they also evade `arch:dead` if ignored.
- Triplicated OptionsBuilder violates DRY for zero benefit.
- A dialect calling `MetadataStorage.getEntity` couples SQL generation to a global singleton registry instead
  of receiving metadata as a parameter — hurts testability (tests must populate global state) and violates
  Dependency Inversion. The provider already has metadata; passing it in is cleaner.
- Importing `@ts-linq/core` into a dialect inverts the intended layering (core/provider sit above dialects).

## Target architecture
- Delete the dead `chunk*Batch` functions (or, if they encode intended logic, move the one canonical chunker to
  the shared dialect kit and have the ORM `BatchExecutor` consume it — verify first).
- Replace the three OptionsBuilders with one shared generic `DialectOptionsBuilder` (or a tiny factory) in the
  shared kit; dialect packages re-export thin named aliases for API stability.
- Move `SqlHelper.formatValue` into the shared dialect kit (it is SQL-literal formatting, a dialect concern, not
  a core/runtime concern) to remove the dialect→core import.
- Change `buildSelect` to accept `EntityMetadata` (resolved by the provider) instead of calling
  `MetadataStorage.getEntity` internally — Dependency Inversion + parameterize-from-above.

## Proposed refactor
1. Confirm `chunk*Batch` are unused (grep + `arch:dead`); remove them and drop from `index.ts` exports.
2. Extract a single `DialectOptionsBuilder`; alias per dialect for backward-compatible names.
3. Relocate `formatValue` to the shared kit; update DDL strategies; remove `@ts-linq/core` dep where it becomes unused.
4. Refactor `buildSelect` signature to take metadata; update the three providers (which already have it) to pass it.

## Suggested design patterns
- **Dependency Inversion / Parameterize from above** for metadata. WHY: removes hidden global coupling, enables pure unit tests.
- **Dead-code elimination** for `chunk*Batch`. WHY: smaller, honest public surface.
- **Shared utility (SSOT)** for OptionsBuilder and `formatValue`. WHY: one place to evolve.

## Testing plan
- `arch:dead` confirms `chunk*Batch` removal leaves no dangling references.
- Unit: shared `DialectOptionsBuilder` behavior; aliases still construct.
- Refactor `buildSelect` tests to pass metadata directly (drop global registry setup), proving reduced coupling.
- `arch:deps` confirms the dialect→core edge is removed (or justified) after `formatValue` relocation.

## Acceptance criteria
- [ ] `chunk*Batch` removed (or relocated + actually consumed); `index.ts` exports updated.
- [ ] One shared OptionsBuilder; per-dialect names preserved as aliases.
- [ ] `formatValue` no longer imported from `@ts-linq/core` by dialects (relocated).
- [ ] `buildSelect` receives metadata; no `MetadataStorage.getEntity` inside dialects.
- [ ] `pnpm arch:deps`, `arch:dead`, `arch:cycles`, `typecheck`, `tests:unit`, `build` pass.

## Refactor order
1. Dead `chunk*Batch` removal (zero risk). 2. OptionsBuilder dedup. 3. `formatValue` relocation. 4. `buildSelect` metadata signature (coordinate with providers; needs a changeset).

## Notes
The `buildSelect`-signature change is the only consumer-facing API change here and should be batched with the
`task-1` base-dialect work to avoid two breaking passes. Verify the chunkers are truly dead before deleting —
the ORM `BatchExecutor` (`packages/orm/src/save-changes/batch-executor.ts`) is the real chunking path.
