---
status: not-started
phase: phase-x
package: types
priority: P1
effort: L
risk: medium
category: package-boundary
depends_on: []
related: ['types/task-2.md']
---

# Refactor: Split the 1275-line `@ts-linq/types/index.ts` mega-barrel into cohesive modules

## Problem
`packages/types/src/index.ts` is a single 1275-line file that declares the entire shared
type surface of the ORM in one flat module with no internal boundaries. It mixes at least a
dozen unrelated concern groups: SQL clauses, query options, logging/diagnostics, dialect
contract, resilience/fallback, connection/pool config, value converters, results,
metadata model, stored-procedure types, JSON/owned/complex types, hierarchy/spatial
translators, and caching. Everything is `export`ed from the same file.

## Evidence
- `packages/types/src/index.ts` — 1275 lines, ~150 top-level `export`s in one file.
- Distinct concern clusters visible by line range:
  - SQL clauses / query options: lines 7-64.
  - Logging/diagnostic info types: lines 81-211 (`Logger`, `SqlLogger`, `QueryStartInfo`…`CacheSizeInfo`).
  - Dialect contract: line 271 `SqlDialect`.
  - Middleware/interception: lines 308-345.
  - Resilience/retry/circuit/fallback: lines 346-537.
  - Cache types: lines 539-596.
  - Value converters/generators/sequences: lines 637-696.
  - Metadata model: `ColumnMetadata` (696), `RelationshipMetadata` (757), `EntityMetadata` (981), `ShadowPropertyMetadata` (1029)…
  - Stored procedure: lines 769-823.
  - JSON/owned/complex/hierarchy: lines 868-954.
  - Spatial/hierarchy translators: lines 1162-1183.
- `Result`/`ok`/`err` runtime helpers (lines 478-491) live in the same barrel as pure types — the package is mostly types but also ships runtime values.

## Why this is bad
- **Maintainability**: a 1275-line file is hard to navigate; unrelated edits collide.
- **API evolution**: no sub-paths means consumers import the whole surface; tree-shaking and granular deprecation are harder.
- **Cohesion**: metadata-model types, dialect contracts, and logging DTOs have nothing to do with each other yet share a file.
- **Review risk**: changes to one concern touch the same file as every other concern.

## Target architecture
Split into cohesive modules under `packages/types/src/` (e.g. `sql.ts`, `logging.ts`,
`dialect.ts`, `resilience.ts`, `cache.ts`, `metadata.ts`, `value-conversion.ts`,
`stored-procedure.ts`, `json-owned.ts`, `spatial-hierarchy.ts`, `results.ts`,
`config.ts`) and have `index.ts` re-export them as a curated barrel. Keep the public
import path `@ts-linq/types` stable (no consumer change), optionally add subpath exports
later. Apply Interface Segregation at the module level.

## Proposed refactor
1. Group declarations by concern into separate files (move, do not rewrite, to keep diffs reviewable).
2. `index.ts` becomes `export * from './sql'; export * from './metadata'; …`.
3. Move `Result`/`ok`/`err` runtime helpers into `results.ts` (still re-exported).
4. Verify no import-cycle is introduced between the new modules (`arch:cycles`).
5. Keep every currently-exported name available from `@ts-linq/types` (no breaking change).

## Suggested design patterns
- **Module facade** — `index.ts` is the curated facade over concern modules.
- **Interface Segregation** at file granularity.

## Testing plan
- Build/type-level: every previously-exported symbol still resolves from `@ts-linq/types`.
- `arch:cycles`/`madge`: no cycles among the new modules.
- Downstream typecheck across the monorepo unchanged.

## Acceptance criteria
- [ ] `index.ts` is a thin re-export barrel; declarations live in concern modules.
- [ ] All existing exports remain importable from `@ts-linq/types`.
- [ ] No new import cycles.
- [ ] Monorepo `typecheck`/`build` pass.

## Refactor order
Do early in the types package — it makes `types/task-2` (error consolidation) and downstream
typed-error work land in clean modules. Pure move/re-export = low risk.

## Notes
This is a non-breaking *internal* reorganization if the barrel preserves all names. If subpath
exports are added (`@ts-linq/types/metadata`), that is a *minor* additive change — gate behind a
separate decision.
