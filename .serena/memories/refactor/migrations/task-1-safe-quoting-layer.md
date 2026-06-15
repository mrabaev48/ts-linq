# refactor migrations/task-1 — injection-safe quoting layer

✅ DONE — **migrations' 1ST refactor task** (P0, high-risk, security). Branch
`audit-refactor/migrations-safe-quoting-layer`. migrations stays 🔄 In Progress (tasks 2–7 pending).

## What changed
- **New quoting layer** `packages/migrations/src/builders/quoting/`:
  - `SqlQuoter.ts` — port: `id(identifier)`, `qualified(...parts)` (each part escaped, joined `.`),
    `literal(value)` (single audited literal encoder, folds legacy `formatValue`).
  - `BaseQuoter.ts` — abstract base: `open`/`close`/`escapeChar`/`escapedChar` + abstract
    `formatBoolean`. `id()` uses split/join (no RegExp pitfalls). `literal()` matches old
    `formatValue` exactly (null→NULL, number→String, Date→ISO `'…'`, string→`'…'` with `'`→`''`).
  - `PostgresQuoter` (`"`→`""`, bool TRUE/FALSE), `MySqlQuoter` (`` ` ``→`` `` ``, bool 1/0),
    `MssqlQuoter` (`]`→`]]` only closing bracket, bool 1/0).
  - `QuoterFactory.for(dialect)` — Factory; cached stateless singletons keyed by `Dialect` union.
- **Facade**: `SqlUtils.ts` `q()`→`QuoterFactory.for(d).id()`, `formatValue()`→`.literal()`.
  Signatures unchanged → all existing callers (q/formatValue used across builders/handlers) fixed
  transitively. Byte-for-byte identical output for non-adversarial input (golden SQL tests green).
- **Bypassing builders migrated** (raw quote interpolation removed):
  - `SequencesSqlBuilder.ts` — holds a `quoter`; `seqName()` helper uses `qualified()`/`id()`;
    MySQL emulation table DDL became `mysqlTableDdl()` method building every identifier via
    `quoter.id()`; INSERT/DELETE use `quoter.id()`/`quoter.literal()`. (`MYSQL_SEQ_TABLE_DDL`
    module const removed.)
  - `MigrationHandlers.ts` `buildAdd/DropUniqueConstraintSql` MySQL/MSSQL branches → `q()`.
  - `handlers/TableHandlers.ts` inline CREATE-TABLE unique-constraint MySQL/MSSQL branches → `q()`
    (NOT in the task's flagged list — discovered via guard; same vuln; task-7 will dedupe these).

## Guard (BOTH, per user decision; ESLint rule must be SCOPED not global)
- **eslint-config factory enhanced**: `packages/eslint-config/index.mjs` `createNodeConfig` gained
  backward-compatible `overrides?: Array<{files, ignores?, rules}>` option → appended as scoped
  flat-config blocks (block #8, last, so they win). Lets consumer packages add package-local scoped
  rules without touching global rule sets. (eslint-config excluded from changesets.)
- **First per-package flat config**: `packages/migrations/eslint.config.mjs` — self-contained via
  factory (ESLint resolves nearest config; migrations now uses its own, others still use root
  `eslint.config.mjs`). Scoped `no-restricted-syntax` on `src/builders/**` (ignore `quoting/**`):
  `TemplateElement[value.raw=/(\\`|\[|\]|")$/]` + `^…` → flags quote char glued to `${…}`. No
  false positives on current builders (verified).
  - Needs `packages/migrations/tsconfig.eslint.json` (extends tsconfig.json, composite:false,
    rootDir:".", include src+tests+tests-new, paths `@src/*`+`@ts-linq/*`→`../*/src`) for typed lint.
- **Unit guard test** `tests-new/quoting/no-raw-quote.test.ts` — precise source scan
  (regex `/\\`\$\{|\}\\`|\[\$\{|\}\]|"\$\{|\}"/`) over `src/builders/**` excl. `quoting/`.

## Tests
- `tests-new/quoting/SqlQuoter.test.ts` — per-dialect adversarial id escaping (a"b/a`b/a]b),
  cannot-break-out payloads, qualified, literal table (incl 3-dialect bool), Date, round-trip.
- Added quote-containing cases to `tests/sequences-sql-builder.test.ts` +
  `tests-new/seed/SeedsSqlBuilder.test.ts` (O'Brien, embedded quote in identifier).

## Validation — all green
typecheck ✅, lint ✅ (0 errors), test:unit ✅ 3490, build ✅, integration ✅ 461, e2e ✅ 290,
arch:deps/cycles/dead ✅.

## Changeset
`@ts-linq/migrations` **patch** (security+correctness; q/formatValue signatures retained, new
quoting types internal/not barrel-exported → additive). Security note in summary.

## Coordination / follow-ups
- **task-3**: bundle/script code-gen (`bundle/build-bundle.ts`, `script/idempotent-emitter.ts`) also
  interpolates raw strings into generated SQL/code — out of scope here, must route through quoter too.
- **task-7**: MigrationHandlers + TableHandlers unique-constraint branches are duplicated; dedupe
  there (e.g. reuse `buildAddUniqueConstraintSql`). I left both quoting-corrected but still duplicated.
- **Boundary smell**: migrations re-implements dialect SQL/quoting instead of delegating to the
  dialect packages (which own quoting for the query path). Flagged for follow-up.
- **eslint pattern**: only migrations has a per-package config now; existing root scoped overrides
  (metadata, core/loading) left in root — could migrate to per-package configs later.