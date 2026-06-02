# Refactor Audit: core

## Package responsibility
`@ts-linq/core` provides the foundational runtime abstractions of the ORM: the abstract
`DatabaseProvider` base (connection/CRUD/query/transaction/resilience contract), the
eager/lazy loading layer (`EntityLoader`, `RelationshipLoader`, `LazyLoadingProxy`),
decorators (`@Entity`/`@Column`/`@PrimaryKey`/relationships/validation), batch operations,
interceptor interfaces, owned-entity hydration, and value-object trees (spatial, hierarchy).
It depends on `@ts-linq/types`, `@ts-linq/metadata`, `@ts-linq/ast`, `@ts-linq/metrics-safe`.

## Current architectural problems
- **God class `DatabaseProvider`** (~1005 LOC) concentrating ~10 cross-cutting responsibilities behind one inheritance root (task-1).
- **Hidden singleton coupling**: the loading layer reads the process-wide `MetadataStorage` singleton directly, breaking documented per-context/multi-tenant isolation and testability (task-2).
- **God class + duplication in `EntityLoader`** (~592 LOC) with parallel single/batched paths and logic duplicated against `RelationshipLoader` (task-3).
- **Raw, string-interpolated SQL with injection surface** in `RelationshipLoader` junction reads — a dialect leak in the provider-agnostic package (task-4).
- **Silent-swallow / unsafe-fallback catch blocks** on hot CRUD/loading paths (`upsert`, `hydrateJson`, relationship load) (task-5).
- **Bare `throw new Error`** (22 sites) despite an existing typed error hierarchy (task-6).
- **`as unknown as` double-casts and `Record` punning** throughout loaders erode type safety (task-7).
- **Direct `console` logging + static logger global** bypass the logging abstraction (task-8).
- **Uncurated `export *` barrel** with documentation drift (task-9).

## Refactor goals
- Decompose the provider god class into injected, unit-testable collaborators.
- Invert metadata + logger dependencies (constructor injection, no global service locator).
- Make all SQL emission dialect-safe and parameterized; keep core provider-agnostic.
- Adopt a consistent typed-error + no-silent-swallow policy.
- Restore type safety in the loading layer.
- Curate the public API surface.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-4 | P0 | Self-contained SQL-injection/dialect-leak fix; ship first |
| 2 | task-2 | P0 | Inject `MetadataSource`; unblocks honest loader testing |
| 3 | task-6 | P1 | Typed errors (after types/task-2) before further refactor |
| 4 | task-5 | P0 | Silent-swallow/unsafe-fallback fixes on hot path |
| 5 | task-1 | P0 | Decompose `DatabaseProvider` god class (anchor) |
| 6 | task-3 | P1 | Split `EntityLoader`; remove loader duplication |
| 7 | task-7 | P1 | Remove `as unknown as` casts (do with task-3) |
| 8 | task-8 | P2 | Logger injection / no console |
| 9 | task-9 | P2 | Curate barrel after structure settles |

## Dependencies on other packages
- `@ts-linq/types` — error hierarchy (`types/task-2`), `SqlDialect`/identifier quoting (task-4), metadata interfaces.
- `@ts-linq/metadata` — `MetadataSource` port (`metadata/task-1`) consumed by task-2.
- `@ts-linq/ast` — clean; potential target for declarative junction-read nodes (task-4 option b).

## Testing strategy
- Unit tests per extracted collaborator (analyzer, dispatcher, composite logger, load strategies, chunker) with fakes — newly possible once DI replaces singletons/statics.
- Provider-dialect tests for junction SQL quoting.
- Error-path tests for every formerly-swallowed catch and every typed-error replacement.
- Type-level tests guarding the removal of `as unknown as`.
- Regression: existing provider integration + N+1 batching tests must pass unchanged (public API stable).

## Notes
The earlier known-evidence that `SequenceRegistry` leaks into `core/loading` is **stale**:
the current tree shows `SequenceRegistry` is not imported anywhere under `packages/core/src`
(only `migrations` and `orm` use it). Spatial code in core does **not** emit WKT/SQL strings.
The AST package is clean. The single confirmed SQL leak in core is the `RelationshipLoader`
junction reads (task-4).
