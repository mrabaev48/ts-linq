# Refactor Audit: migrations

**Status: ✅ Complete** — task-1, task-2, task-3, task-4, task-5, task-6, task-7 ✅ completed. All tasks done.

## Package responsibility

`@ts-linq/migrations` owns the *schema-evolution* half of the ORM:

1. **Model snapshotting** — turning the in-memory `MetadataStorage` model into a
   deterministic, serializable snapshot (`SchemaSnapshot.ts`, `snapshot/model-snapshot.ts`).
2. **Schema diffing** — comparing an expected snapshot against an actual one and
   producing a structured `SchemaDiff` (`SchemaComparator.ts`, `comparators/*`,
   `snapshot/diff.ts`, `seed/SeedDiff.ts`).
3. **DDL/DML emission** — rendering a `SchemaDiff` into dialect-specific SQL
   (`DialectMigrationSql.ts`, `builders/*`, `builders/handlers/*`).
4. **Migration authoring & running** — `MigrationBuilder`, `Migration`,
   `MigrationRunner` (apply/rollback), idempotent-script and self-contained-bundle
   generation (`MigrationRunner.ts`, `MigrationBuilder.ts`,
   `script/idempotent-emitter.ts`, `bundle/build-bundle.ts`).
5. **DB-first scaffolding** — reverse-engineering a live DB into entity/DbContext
   source (`scaffold/*`).

Prod deps: `@ts-linq/core`, `@ts-linq/metadata`, `@ts-linq/types`, `esbuild`. The
three dialect packages are **devDependencies only** — runtime code re-implements
dialect SQL via the `Dialect` string union instead of delegating.

## Current architectural problems

- **Unescaped SQL identifier quoting (P0).** `builders/SqlUtils.ts:3` `q()` wraps an
  identifier in quote chars without escaping embedded quotes. Every DDL/DML builder
  funnels through it; direct interpolation also occurs in `script/idempotent-emitter.ts`,
  `builders/SequencesSqlBuilder.ts`, `builders/SeedsSqlBuilder.ts`.
- **`MigrationRunner` mixes orchestration, persistence, dialect SQL, logging, and error
  handling (P0).** `console.log`, generic `throw new Error(...${error})` (lost cause),
  provider-specific `?` placeholders, swallowed catch, no per-step idempotency contract.
- **Code-gen by string concatenation (P0).** `bundle/build-bundle.ts` interpolates
  absolute paths and provider names into a generated `.mjs` — injection + Windows-path
  breakage.
- **God snapshot builders (P1).** `SchemaSnapshot.ts` (414 LOC) and
  `snapshot/model-snapshot.ts` (427 LOC) each fuse TPH/TPT/TPC, owned, complex, split,
  fragment, and skip-nav expansion into one class, reading the global `MetadataStorage`.
- **Duplicated dialect dispatch (P1).** The inspector-selection `if (label === …)` chain
  is copy-pasted in `SchemaSnapshot.buildActualFromProvider` and
  `services/SchemaInspectionService.ts`.
- **`builders/MigrationHandlers.ts` re-export grab-bag (P2)** — 359 LOC mixing live
  logic, dead `// moved to …` comments, and structural casts instead of real types.
- **Weak error model throughout** — no typed errors/codes, lost `cause`.

## Refactor goals

1. Single audited identifier/literal quoting layer with per-dialect escaping.
2. Decompose `MigrationRunner` into orchestration + `MigrationHistoryStore` + injected
   logging + typed errors; transaction-safe and testable.
3. Replace string-concatenation code-gen with safe templating + explicit escaping.
4. Split snapshot builders into composable strategy-based expanders, decoupled from the
   `MetadataStorage` global (inject the model).
5. Centralize dialect-inspector selection behind one factory.
6. Introduce a typed error hierarchy with codes, context, `cause`.

## Recommended task order

| Order | Task | Priority | Status | Reason |
|---:|---|---|---|---|
| 1 | task-1.md — Injection-safe identifier/literal quoting layer | P0 | ✅ Completed | Security + correctness in the hot DDL/DML path; everything builds on it |
| 2 | task-2.md — Decompose MigrationRunner (history store, logging, errors, tx) | P0 | ✅ Completed | Runner → thin orchestrator over injected `MigrationHistoryStore` + `TransactionScope` + `MigrationLogger`; **silent-swallow data-corruption fix** (`list()` existence-probes instead of returning `[]` on any error); task-4 typed errors with preserved `cause` + suppressed-error chaining on rollback failure; `__migrations` schema shared with the idempotent emitter; `new MigrationRunner(provider)` retained |
| 3 | task-3.md — Safe bundle/script code generation | P0 | ✅ Completed | New `JsLiteral` encoder (`bundle/codegen/JsLiteral.ts`) — `generateEntrySource` now emits structure and routes every path leaf through JSON-escaped, POSIX-normalized `modulePath()`; idempotent emitter reuses task-1 `literal()` for `version`/`name` + fail-fast `BundleBuildError` on malformed identifiers; generated runtime allow-lists `DB_PROVIDER` (`postgres\|mysql\|mssql`) before the dynamic import; `__migrations` shared schema confirmed converged. Closes arbitrary-code (bundle) + arbitrary-SQL (script) injection |
| 4 | task-4.md — Typed error hierarchy for migrations | P1 | ✅ Completed | Foundation for error model; **pulled ahead of task-2/task-3** to satisfy task-2's `depends_on` (runner consumes `MigrationApplyError`/`MigrationRollbackError`). Classes extend `OrmError` in `@ts-linq/types` (CLAUDE.md §16 — no parallel hierarchy); non-runner serializer/bundle/seed sites migrated, runner deferred to task-2 |
| 5 | task-5.md — Decompose snapshot builders into strategy expanders | P1 | ✅ Completed | Both god-builders → thin coordinators over ordered `EntityExpander` strategies (`snapshot/expanders/`): model = `OwnedEntity`/`ComplexType`/`Inheritance`/`SkipNavigation`; schema = `ShadowProperty`/`TableFragment`/`Sequence` + `ForeignKeyResolver`. Single `ColumnMapper` owns the column→snapshot mapping (model + schema + shadow + portable-type). `MetadataStorage`/`SequenceRegistry` coupling inverted via additive public `buildFrom(entities[, sequences])`; no-arg `buildFromMetadata`/`buildExpectedFromMetadata` retained as back-compat default. Canonical sorting centralized in the model coordinator; expanders read only the injected context |
| 6 | task-6.md — Centralize dialect-inspector selection | P1 | ✅ Completed | New `SchemaInspector` interface + `SchemaInspectorFactory.for(label, provider)` (`SchemaInspector.ts`) — the single dialect → inspector selection point (Factory + ISP + DIP). Both duplicated dispatch chains (`SchemaSnapshot.buildActualFromProvider`, `SchemaInspectionService.buildActualSnapshot` ×2) now resolve one inspector via the factory; no `if (label === …)` inspector dispatch remains outside it. The two divergent unknown-dialect fallbacks (assume-exists vs empty indexes) are unified into one documented policy: unsupported labels throw the typed `UnsupportedOperationError` (`@ts-linq/types`). Supported-dialect snapshots unchanged |
| 7 | task-7.md — Clean up MigrationHandlers grab-bag + structural casts | P2 | ✅ Completed | Full pure-barrel: the 359-LOC hybrid `builders/MigrationHandlers.ts` is **deleted**; its live logic moved to the matching `handlers/*` files (index → `IndexHandlers`, column-change + computed/default predicates → `ColumnHandlers`, FK creates → `ForeignKeyHandlers`) and the unique-constraint SQL consolidated into `UniqueConstraintsSqlBuilder` (already routing through the task-1 quoter — bypass confirmed closed). The four `*SqlBuilder`s and `index.ts` import directly from the new homes; all previously-exported names (`buildAddUniqueConstraintSql`, `buildDropUniqueConstraintSql`, `buildCreateIndexSql`) stay importable. Structural casts in the moved predicates removed — the fields (`isComputed`/`computedExpression`/`computedStorage`/`defaultExpression`) were already first-class on `ColumnDef`; new type-level + adversarial-escaping + barrel-contract tests added. Dead `// moved to …` comments gone with the file |

## Dependencies on other packages

- **Prod:** `@ts-linq/core` (`DatabaseProvider`), `@ts-linq/metadata`
  (`MetadataStorage`, `SequenceRegistry`), `@ts-linq/types`, `esbuild`.
- **Dev-only:** `@ts-linq/dialect-{mssql,mysql,postgres}` (tests). Runtime re-implements
  dialect SQL rather than delegating — a boundary smell (the dialect packages already
  own quoting/DDL for the query path; migrations duplicates it). Flagged for follow-up.

## Testing strategy

- **Contract tests** for the quoting layer: every dialect must round-trip adversarial
  identifiers (embedded quote chars) without breaking out.
- **Provider-dialect matrix tests** (golden SQL) for DDL/sequence/seed builders.
- **Runner tests** with a fake provider asserting tx begin/commit/rollback ordering,
  history writes, and typed-error rethrow with `cause`.
- **Snapshot tests** driven by an injected model (not the global singleton), covering
  each inheritance/owned/complex/fragment strategy in isolation.
- **Error-path tests** for serializer/deserializer invalid input.

## Notes

- LOC ≈ 9.6K. Largest: `model-snapshot.ts` (427), `SchemaSnapshot.ts` (414),
  `MigrationBuilder.ts` (333), `idempotent-emitter.ts` (253), `build-bundle.ts` (252).
  (`MigrationHandlers.ts`, formerly 359, was removed in task-7 — its logic now lives in
  `handlers/*` and `UniqueConstraintsSqlBuilder`.)
- ~~`idempotent-emitter` and `MigrationRunner` define the `__migrations` table schema
  independently and slightly differently — consistency risk noted in task-2.~~ ✅ Resolved
  in task-2: both now consume the single `runner/MigrationsTableSchema.ts`
  (`MIGRATIONS_TABLE` + `buildEnsureMigrationsTableSql`).

### task-5 follow-ups (tech debt)

- **Global-registry default path remains.** `buildFromMetadata()` /
  `buildExpectedFromMetadata()` still read `MetadataStorage` / `SequenceRegistry`. All
  current callers (`DiffMigrationGenerator`, CLI `Schema*Command`, orm
  `has-pending-model-changes`) use the no-arg path. Eventual removal: have callers inject
  the model via `buildFrom(...)`, then drop the singleton reads.
- **Coordination with task-6** (centralize dialect-inspector selection): ✅ Resolved by task-6.
  `buildActualFromProvider`'s per-dialect inspector dispatch now resolves one inspector via
  `SchemaInspectorFactory.for(label, provider)` instead of inline `postgresql`/`mysql`/`mssql`
  `if`s; the same factory backs `SchemaInspectionService`.
- **`ForeignKeyResolver` is a collaborator, not an `EntityExpander`** (it returns FKs instead
  of mutating the table map). Same for the keyless→view routing and the inline
  index/uniqueConstraint mapping, which stay in the schema coordinator. These were left out of
  the expander interface deliberately (scope), and could be folded into the strategy model
  later if the coordinator grows further.

### task-7 follow-ups (tech debt)

- **Quoter bypass confirmed closed.** The unique-constraint SQL (now in
  `UniqueConstraintsSqlBuilder`) routes every identifier through `q()` →
  `QuoterFactory.for(dialect)` (task-1). No raw `` `${tableName}` `` / `[${tableName}]`
  interpolation remains anywhere in the unique-constraint path; covered by the new
  adversarial-escaping test.
- **Remaining structural casts elsewhere in `migrations` (out of task-7 scope).** A handful of
  `as { … }` casts still read loosely-typed *actual-snapshot* shapes returned by introspection:
  `builders/handlers/ColumnHandlers.ts:51` (`defaultExpressionDialect` in `renderColumn` — not a
  declared `ColumnDef` member), `SchemaSnapshot.ts:127-131,240`,
  `comparators/IndexComparator.ts:25-30`, `comparators/ColumnComparator.ts:12-13`. These were not
  in task-7's evidence (which targeted the now-deleted `MigrationHandlers` predicates) and reach
  fields on provider-introspected objects rather than the typed model. Candidate follow-up: model
  the actual-snapshot shape as a typed interface (or promote `defaultExpressionDialect` onto
  `ColumnDef`) so these casts can be dropped too.
