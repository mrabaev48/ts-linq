# Refactor Audit: types

## Package responsibility
`@ts-linq/types` is the zero-dependency foundation package: it declares the shared type
contracts consumed by every other package (SQL clauses, query options, dialect contract,
logging/diagnostic DTOs, resilience/fallback, connection config, value conversion, the
entity-metadata model, stored-procedure types, JSON/owned/complex types, spatial/hierarchy
translators, caching) plus a small set of runtime helpers (`Result` constructors, type
guards, enums) and the base error hierarchy. `package.json` declares no dependencies.

## Current architectural problems
- **1275-line mega-barrel** (`index.ts`) mixing ~12 unrelated concern groups in one flat file (task-1).
- **Inconsistent error hierarchy** with no common `OrmError` root, no error codes, partial `cause` preservation, and divergence from the richer `AstSqlGenerationError` (task-2).
- **Runtime values mixed into a "types" package** without clear isolation (task-3).
- **Weak `Function`/broad-union types** in the shared metadata model that propagate casts downstream (task-4).

## Refactor goals
- Decompose the barrel into cohesive, cycle-free modules behind a stable facade.
- Establish one project-wide typed-error taxonomy rooted at `OrmError`.
- Make the runtime footprint explicit and isolated.
- Tighten entity-target typing at the source to enable downstream cast removal.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1 | P1 | Split the mega-barrel into modules (enables everything else) |
| 2 | task-2 | P1 | Consolidate error hierarchy (prereq for core typed throws) |
| 3 | task-3 | P2 | Isolate runtime values from pure types |
| 4 | task-4 | P3 | Tighten `Function`/union metadata types (enabler) |

## Dependencies on other packages
- None inbound (zero-dep). Outbound impact: every package consumes these types, so changes
  must stay backward-compatible (preserve barrel names). Proposed home for `MetadataSource`
  (`metadata/task-1`) and `EntityCtor`/`EntityRef` (`metadata/task-5`, `core/task-7`) to keep
  dependency direction clean.

## Testing strategy
- Build/type-level: every previously-exported symbol still resolves from `@ts-linq/types`
  after the split (no breaking change).
- `arch:cycles`/`madge`: no import cycles among the new modules.
- Type-level tests for the `OrmError` taxonomy and tightened metadata types.
- Monorepo-wide `typecheck`/`build` as the regression gate (this package is the root of the type graph).

## Notes
This package is the lowest layer of cluster C1; its refactors are mostly *enablers* for core
and metadata. Keep all changes additive/backward-compatible at the barrel level; gate any
narrowing (task-4) on a monorepo-wide typecheck to size the changeset correctly.
