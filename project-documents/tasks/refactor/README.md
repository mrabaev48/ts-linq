# ts-linq Refactor Audit

> Phase: `phase-x` · Audit date: 2026-06-02 · Mode: audit-only (no production source modified)
> Scope: full monorepo — 37 packages + 1 cross-cutting `_shared` group.
> Output: **178 task files** + **38 package READMEs** under `phase-x/`.

## Purpose

This refactor audit re-derives, **from the current code**, the architectural, design,
maintainability, testability, extensibility, and production-readiness problems that must be
resolved before the next feature phase (Cosmos/SQLite/InMemory providers, read replicas,
primitive collections, vector search). It is a **fresh, independent, clean-slate** audit: every
finding is grounded in current `path:line` evidence and is independent of the prior
`project-documents/issues/issues-v1…v5` rounds (several of which were fixed, some regressed, some
never closed).

Each discrete problem is a single task file with full frontmatter, evidence, target architecture,
a concrete refactor plan, named design patterns, a testing plan, and acceptance criteria. No
source code was changed; only Markdown under `project-documents/tasks/refactor/` was created.

## Global findings (cross-cutting)

1. **God classes on hot paths.** `Queryable` (1812 LOC), `DbContext` (1094), `DatabaseProvider`
   (1005), `DbSet` (797), the three providers (679/578/532), `ChangeTracker` (648),
   `PrometheusSqlLogger` (663), `MigrationRunner`, `TestProvider` (632), `MetadataRegistry` (575),
   `EntityTypeBuilder` (575), `EntityLoader` (592), and the `types` barrel (1275). None are caught
   by the mechanical arch tools (no per-file LOC / method-count gate exists).

2. **Unsafe SQL string construction in supposedly safe layers.** Raw, unescaped identifier/literal
   interpolation appears in `core/RelationshipLoader` (junction reads), `migrations` DDL/seed/bundle
   emitters, the MSSQL DDL path, provider upserts (MERGE/ON CONFLICT/ON DUPLICATE KEY), and — most
   seriously — **`plugin-multi-tenant` interpolates the tenant id into raw SQL** (injection). A
   correct `quoteIdentifier` often exists but is bypassed.

3. **Silent error swallowing.** ~150 bare/empty `catch` blocks and ~200 generic `throw new Error(`
   across non-test source. Several swallow on correctness-critical paths: global query-filter drop
   (potential row leak in `query`), tenant resolver failure → unfiltered query (fail-open isolation),
   Postgres driver-load failure behind a swallowing catch with a broken import path, CLI command
   failures swallowed into empty output, provider rollback/disconnect assuming state.

4. **Provider/dialect duplication with no shared abstraction or capability model.** Three dialects
   are ~85% identical; three providers triplicate `mapRowToEntity`/`coerceToSqlParameter` (already
   drifted) and have three inconsistent error mappers + three transient-code lists. Optional dialect
   methods are runtime-sniffed (`if (!dialect.buildX) throw`) instead of an explicit capability type.

5. **Drivers and singletons defeat testability.** Providers hard-`require` their drivers (no DI →
   only real-DB tests). The `MetadataStorage` singleton is reached into directly from the core
   loading layer (breaks multi-tenant isolation). `TestProvider`'s regex SQL engine, used by 57+
   tests, risks mock drift / false green.

6. **Public/internal API boundary is unenforced.** Internal collaborators are re-exported from
   package barrels without an `@internal` discipline, freezing implementation details as contract.

7. **Dead / placeholder / orphaned code.** `pagination`, `examples`, `integration-nestjs` are
   placeholders; the three plugins are orphaned (no package depends on them) and the
   `OrmMiddleware` lifecycle hooks they target are **never invoked** by the runtime; `metadata/src`
   contains committed build artifacts; `concurrency` retry policies are byte-duplicated in `core`.

8. **Observability cardinality + duplication risk.** `prometheus-sql-logger` derives metric labels
   from arbitrary parsed SQL (unbounded time-series). `telemetry` and `open-telemetry-sql-logger`
   duplicate span-mapping logic and silently discard event classes.

9. **Config drift.** Stale/missing Jest module aliases (`@ts-linq/config` ghost, missing
   `@ts-linq/transformer`); the `no-unsafe-*` lint family never reaches `error`; base tsconfig lacks
   `noUncheckedIndexedAccess` despite pervasive index access.

## Refactor principles (mandatory)

- **SOLID** — especially SRP (decompose god classes), OCP/DIP (capability model, driver inversion),
  ISP (split fat option/interface types), LSP (consistent dialect/provider contracts).
- **Clean Architecture** — domain/core must not depend on infrastructure; dialect/provider specifics
  stay out of generic packages; dependencies point inward.
- **Clean Code** — small focused units, no dead code, no magic strings/side channels.
- **Composition-first** — collaborators over inheritance; Template Method/Strategy where a shared
  base genuinely reduces duplication.
- **Explicit error handling** — typed error hierarchy with codes, context payloads, cause chains,
  package boundaries, user-safe messages; **zero silent swallows**.
- **Strong TypeScript** — remove unsafe `any`/`as unknown as`; model runtime invariants in types;
  type-level tests for public API inference.
- **Provider/dialect isolation** — Ports & Adapters; explicit capability objects; centralized
  identifier quoting and parameterization.
- **Testability** — dependency inversion everywhere a driver/clock/registry is touched; shared
  contract-test harness for dialects and providers.

## Package refactor order

Ordered so that foundational correctness and shared abstractions land before the packages that
depend on them. Earlier rows unblock later rows.

| Order | Package(s) | Reason | Risk | Depends on |
|---:|---|---|---|---|
| 1 | `types` | Canonical error hierarchy + split barrel; everything imports it | medium | — |
| 2 | `metadata` | Remove committed artifacts; introduce read-port; tame registry god class | medium | types |
| 3 | `core` | Decompose `DatabaseProvider`/`EntityLoader`; kill SQL injection + singleton coupling + silent catches | high | types, metadata |
| 4 | `ast` | De-dupe jsonPath node; relocate SQL-fragment DTOs (small, low risk) | low | types |
| 5 | `sql-visitor` | Unify visitor contract + dispatch registry; fix param-state numbering | medium | ast, types |
| 6 | `query` | Decompose `Queryable`; fix immutability/aliasing; wire `SqlVisitorOptions`; move SQL to dialect | high | core, sql-visitor, metadata |
| 7 | `transformer` | De-dupe entrypoints; stop swallowing TypeChecker failures | medium | ast |
| 8 | `concurrency` | Single source of truth for retry policies; injectable clock | medium | core |
| 9 | `orm` | Decompose `DbContext`/`ChangeTracker`/`DbSet`; typed errors; public/internal boundary | high | query, core, metadata |
| 10 | `dialect-*` | Shared base dialect (Template Method) + capability model + central quoting + contract tests | high | sql-visitor, types |
| 11 | `testkits` | Contract-test harness + decompose `TestProvider`; unify provider interface | medium | core, dialect-* |
| 12 | `provider-*` | Decompose god classes; shared mapper/coercer + error registry; invert driver dep; capability model | high | core, dialect-*, testkits |
| 13 | `migrations` | Injection-safe quoting; decompose `MigrationRunner`; safe code-gen; typed errors | high | core, metadata, dialect-* |
| 14 | `cli` | Replace require-based runtime execution / stub provider; provider factory; error/exit-code model | high | orm, migrations, provider-* |
| 15 | `_shared` + `plugin-*` | Decide & unify the extension-point contract; wire-or-retire; fix tenant SQL injection | high | types, orm |
| 16 | `cache`, `cache-redis`, `cache-memcached` | Shared cache-adapter base; canonical interfaces; fix hard deps | medium | types, core |
| 17 | `telemetry`, `open-telemetry-sql-logger`, `prometheus-sql-logger`, `composite-sql-logger`, `metrics-safe` | Bound label cardinality; de-dupe span mapping; failure isolation; explicit Null-Object | medium | types |
| 18 | `eslint-config`, `jest-config`, `typescript-config` | Promote bug-hiding rules to error; fix alias drift; staged strictness | low | — |
| 19 | `pagination`, `examples`, `integration-nestjs` | Decide implement-vs-retire placeholders | low | orm |

> **Why some rows list several packages:** those packages are *peers* — they share one refactor
> theme and the dependency graph imposes no order between them (e.g. the three dialects don't depend
> on each other). The grouped table above is a **thematic map**. If you want to work strictly one
> package at a time, use the fully linearized order below instead.

### Strict sequential order (one package at a time)

This expands every multi-package row into a single, dependency-safe sequence. Do them top to
bottom; finish (refactor + all validations green + changeset) one step before starting the next.
Each package only depends on packages already completed above it.

| # | Package | Tier | Why here | Status |
|---:|---|---|---|---|
| 1 | `types` | foundation | Root of the graph; canonical error hierarchy + split barrel unblock everything. | ✅ done |
| 2 | `metrics-safe` | foundation | Zero-dep Null-Object helpers; needed by `core`/`cache`; tiny. | ✅ done |
| 3 | `metadata` | foundation | Remove committed artifacts, read-port, tame registry. Depends on `types`. | ✅ done |
| 4 | `ast` | foundation | De-dupe jsonPath node; small. Depends on `types`. | ✅ done |
| 5 | `sql-visitor` | foundation | Visitor/dispatch + param-state. Depends on `ast`, `types`. | ✅ done |
| 6 | `concurrency` | foundation | Make retry policies canonical **before** `core` so its duplicate can be deleted. | ✅ done |
| 7 | `core` | runtime | Decompose provider/loader; kill SQL injection + singleton coupling + silent catches. | ✅ done |
| 8 | `query` | runtime | Decompose `Queryable`; immutability; wire `SqlVisitorOptions`; move SQL out. | 🔄 In Progress |
| 9 | `transformer` | runtime | De-dupe entrypoints; stop swallowing TypeChecker failures. Depends on `ast`. |
| 10 | `migrations` | runtime | Injection-safe quoting; decompose runner. Needed by `orm` + `cli`. |
| 11 | `telemetry` | runtime | De-dupe span mapping; masking. Needed by `orm`; do before it. |
| 12 | `orm` | runtime | Decompose `DbContext`/`ChangeTracker`/`DbSet`; public/internal boundary. Top of runtime. |
| 13 | `dialect-postgres` | dialects | **Reference dialect** — extract the shared base dialect + capability model + central quoting here. |
| 14 | `dialect-mysql` | dialects | Consume the shared base; sequence emulation; central quoting. |
| 15 | `dialect-mssql` | dialects | Consume the shared base; fix DDL interpolation + computed-column INSERT. |
| 16 | `testkits` | testing | Contract-test harness + decompose `TestProvider` **before** providers, so they get contract tests. |
| 17 | `provider-postgres` | providers | **Reference provider** — extract shared mapper/coercer + error registry + driver port here. |
| 18 | `provider-mysql` | providers | Consume shared mapper; fix unpinned-pool transaction isolation. |
| 19 | `provider-mssql` | providers | Consume shared mapper; invert driver dependency. |
| 20 | `cli` | tooling | Replace require-based execution / stub provider; provider factory; exit codes. |
| 21 | `_shared` | plugins | Decide & unify the `OrmMiddleware` extension-point contract first. |
| 22 | `plugin-multi-tenant` | plugins | Fix tenant **SQL injection** + fail-closed; wire-or-retire. |
| 23 | `plugin-soft-delete` | plugins | Retire/fold the duplicate of `orm`'s soft delete. |
| 24 | `plugin-audit` | plugins | Wire to a real lifecycle port or retire. |
| 25 | `cache` | cache | Canonical cache interfaces / adapter base **before** the adapters. |
| 26 | `cache-redis` | cache | Implement the shared base; fail-open; client DI. |
| 27 | `cache-memcached` | cache | Implement the shared base; fail-open; client DI. |
| 28 | `open-telemetry-sql-logger` | observability | Reuse `telemetry` span mapping; isolate failures. |
| 29 | `prometheus-sql-logger` | observability | Bound metric label cardinality (P0); decompose. |
| 30 | `composite-sql-logger` | observability | Per-child failure isolation. |
| 31 | `typescript-config` | config | Staged strictness (`noUncheckedIndexedAccess`). See caveat below. |
| 32 | `eslint-config` | config | Promote `no-unsafe-*` to error (staged). |
| 33 | `jest-config` | config | Fix alias drift (ghost `@ts-linq/config`, missing `@ts-linq/transformer`). |
| 34 | `pagination` | placeholders | Implement-vs-retire (overlaps `query` pagination). |
| 35 | `examples` | placeholders | Implement-vs-retire. |
| 36 | `integration-nestjs` | placeholders | Implement-vs-retire. |
| 37 | `integration-tests` | test suites | Update once the runtime stabilizes. |
| 38 | `e2e-tests` | test suites | Final cross-provider verification of the whole refactor. |

**Two caveats to the strict order:**

1. **Security P0s can jump the queue.** The live-exploitable injection findings — `core`
   `RelationshipLoader` (step 7, already early) and `plugin-multi-tenant` (step 22) — can be fixed
   in place as small isolated patches *before* their structural slot if any code path reaches them.
   (`plugin-multi-tenant` is currently orphaned/uninvoked, which lowers its urgency, but patch it
   early anyway if unsure.)
2. **Config strictness (steps 31–33) is intentionally late.** Flipping `noUncheckedIndexedAccess`
   and `no-unsafe-*` to `error` surfaces many violations across *every* package. Doing it after the
   code is cleaned means less churn. Alternative: flip the flags **early** and fix fallout as you
   go through each package — pick one strategy and stick with it; don't toggle repeatedly.

## Cross-cutting task groups

- **God-class decomposition** — `query/task-1`, `orm/task-1`, `orm/task-3`, `orm/task-4`,
  `core/task-1`, `core/task-3`, `metadata/task-2`, provider `task-1`s, `migrations/task-2`,
  `prometheus-sql-logger/task-3`, `testkits/task-2`, `dialect-postgres/task-1`.
- **Error handling (typed hierarchy + codes + cause chains, eliminate silent swallows)** —
  `types/task-2`, `core/task-5`, `core/task-6`, `orm/task-2`, `orm/task-5`, `migrations/task-4`,
  provider `task-3`/`task-8`s, `plugin-audit/task-2`, `plugin-multi-tenant/task-5`,
  `transformer/task-4`, CLI `task-3`.
- **Package boundaries** — `types/task-1`/`task-3`, `metadata/task-3`, `orm/task-6`,
  `concurrency/task-1`, jest/eslint config alias tasks, cache hard-dep tasks.
- **SQL / compiler architecture** — `query/task-4`/`task-6`/`task-7`, `sql-visitor/task-1`/`task-2`,
  `core/task-4`, `migrations/task-1`/`task-3`.
- **Provider / dialect architecture (capability model, shared base, contract tests)** —
  `dialect-postgres/task-1`/`task-2`/`task-6`/`task-7`, provider `task-2`/`task-4`/`task-6`/`task-7`s,
  `testkits/task-1`/`task-3`.
- **Metadata / model building** — `metadata/task-1`/`task-2`, `orm/task-7`, `core/task-2`.
- **Testing / testkits** — `testkits/*`, `integration-tests/*`, `e2e-tests/*`, contract-harness tasks.
- **Type-level safety** — `types/task-4`, `core/task-7`, `orm/task-8`, `query/task-5`,
  `typescript-config/*`, eslint `no-unsafe-*` promotion.
- **Observability / telemetry** — `prometheus-sql-logger/*`, `telemetry/*`,
  `open-telemetry-sql-logger/*`, `composite-sql-logger/*`, `metrics-safe/*`.
- **Documentation / placeholders** — `pagination/task-1`, `examples/task-1`, `integration-nestjs/*`.

## Completion tracking

| Package | Total | P0 | P1 | P2 | P3 | Status |
|---|---:|---:|---:|---:|---:|---|
| _shared (plugins) | 5 | 1 | 2 | 2 | 0 | not-started |
| ast | 2 | 0 | 1 | 1 | 0 | ✅ done (task-1, task-2 ✅) |
| cache | 3 | 0 | 1 | 2 | 0 | not-started |
| cache-memcached | 3 | 0 | 3 | 0 | 0 | not-started |
| cache-redis | 7 | 0 | 5 | 2 | 0 | not-started |
| cli | 7 | 2 | 3 | 1 | 1 | not-started |
| composite-sql-logger | 3 | 0 | 2 | 1 | 0 | not-started |
| concurrency | 2 | 0 | 2 | 0 | 0 | ✅ done (task-1, task-2 ✅) |
| core | 9 | 4 | 3 | 2 | 0 | ✅ done (task-1/2/3/4/5/6/7/8/9 ✅) |
| dialect-mssql | 4 | 1 | 2 | 1 | 0 | not-started |
| dialect-mysql | 2 | 0 | 2 | 0 | 0 | not-started |
| dialect-postgres | 9 | 1 | 5 | 3 | 0 | not-started |
| e2e-tests | 3 | 0 | 2 | 1 | 0 | not-started |
| eslint-config | 2 | 0 | 1 | 1 | 0 | not-started |
| examples | 1 | 0 | 0 | 1 | 0 | not-started |
| integration-nestjs | 2 | 0 | 0 | 1 | 1 | not-started |
| integration-tests | 4 | 0 | 2 | 1 | 1 | not-started |
| jest-config | 2 | 0 | 2 | 0 | 0 | not-started |
| metadata | 5 | 1 | 2 | 2 | 0 | ✅ done (task-1/2/3/4/5 ✅) |
| metrics-safe | 3 | 0 | 1 | 1 | 1 |  ✅ done |
| migrations | 7 | 3 | 3 | 1 | 0 | not-started |
| open-telemetry-sql-logger | 4 | 0 | 3 | 1 | 0 | not-started |
| orm | 8 | 2 | 4 | 2 | 0 | not-started |
| pagination | 1 | 0 | 0 | 1 | 0 | not-started |
| plugin-audit | 5 | 1 | 3 | 1 | 0 | not-started |
| plugin-multi-tenant | 6 | 2 | 3 | 1 | 0 | not-started |
| plugin-soft-delete | 5 | 1 | 3 | 1 | 0 | not-started |
| prometheus-sql-logger | 5 | 1 | 2 | 2 | 0 | not-started |
| provider-mssql | 9 | 2 | 5 | 2 | 0 | not-started |
| provider-mysql | 8 | 2 | 5 | 1 | 0 | not-started |
| provider-postgres | 8 | 2 | 4 | 2 | 0 | not-started |
| query | 10 | 4 | 4 | 2 | 0 | 🔄 In Progress (task-4, task-8 ✅) |
| sql-visitor | 6 | 0 | 2 | 4 | 0 | ✅ done (task-1/2/3/4/5/6 ✅) |
| telemetry | 3 | 0 | 2 | 1 | 0 | not-started |
| testkits | 6 | 0 | 3 | 3 | 0 | not-started |
| transformer | 4 | 0 | 2 | 2 | 0 | not-started |
| types | 4 | 0 | 2 | 1 | 1 | ✅ done (task-1, task-2, task-3, task-4 ✅) |
| typescript-config | 2 | 0 | 1 | 1 | 0 | not-started |
| **Total** | **179** | **30** | **92** | **52** | **5** | not-started |

## Notes

- `_shared/` hosts cross-plugin tasks (the unwired `OrmMiddleware` contract, shared plugin-kit,
  duplicated `SoftDeleteOptions`). It is not an npm package — it is a task-grouping folder.
- Cross-cutting provider/dialect tasks are filed under the most-affected package and linked via
  `related:` / `depends_on:` to their siblings to avoid duplication.
- A small number of tasks are **investigation/decision** tasks (placeholders, retire-vs-implement)
  where the right answer depends on product direction rather than code alone.
- Several findings are genuine latent bugs surfaced during the audit (e.g. MySQL unpinned-pool
  transaction isolation, Postgres broken-import-behind-silent-catch, MSSQL computed-column INSERT,
  multi-tenant SQL injection, global-filter row leak). These should be triaged ahead of pure
  structural refactors.
