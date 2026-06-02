# Refactor Audit: migrations

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

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Injection-safe identifier/literal quoting layer | P0 | Security + correctness in the hot DDL/DML path; everything builds on it |
| 2 | task-2.md — Decompose MigrationRunner (history store, logging, errors, tx) | P0 | Untestable critical apply/rollback path; silent swallow; lost cause |
| 3 | task-3.md — Safe bundle/script code generation | P0 | Path/identifier injection in generated executable code |
| 4 | task-4.md — Typed error hierarchy for migrations | P1 | Foundation for error model across runner/serializers/builders |
| 5 | task-5.md — Decompose snapshot builders into strategy expanders | P1 | God modules; couples to MetadataStorage singleton; hard to extend |
| 6 | task-6.md — Centralize dialect-inspector selection | P1 | Duplicated dialect dispatch; provider-coupling risk |
| 7 | task-7.md — Clean up MigrationHandlers grab-bag + structural casts | P2 | Clean-code / typescript debt; low cohesion |

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
  `MigrationHandlers.ts` (359), `MigrationBuilder.ts` (333), `idempotent-emitter.ts`
  (253), `build-bundle.ts` (252).
- `idempotent-emitter` and `MigrationRunner` define the `__migrations` table schema
  independently and slightly differently — consistency risk noted in task-2.
