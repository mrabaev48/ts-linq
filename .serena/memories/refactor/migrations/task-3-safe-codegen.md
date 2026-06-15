# refactor migrations/task-3 — safe bundle/script code generation

✅ DONE — **migrations' 4TH refactor task** (P0/M/high-risk, security). Branch
`audit-refactor/migrations-safe-codegen`. migrations stays 🔄 In Progress (tasks 5–7 pending).

## Problem
Two code-gen paths built **executable artifacts** by raw string concat, interpolating FS paths +
migration metadata → arbitrary-code (`.mjs` bundle) / arbitrary-SQL (`.sql` script) when an operator
runs the artifact, plus Windows-path breakage. task-1 fixed builder SQL but these two generators
bypassed the builder layer.

## What changed
- **NEW `packages/migrations/src/bundle/codegen/JsLiteral.ts`** (internal, NOT barrel-exported →
  keeps changeset patch). `JsLiteral.string(v)` = `JSON.stringify` (double-quoted, escaped);
  `JsLiteral.modulePath(p)` = POSIX-normalize (`p.replace(/\\/g,'/')`) then `JSON.stringify` →
  safe ESM import specifier. Builder + Encoder separation (emit structure, encode leaves).
- **`bundle/build-bundle.ts` `generateEntrySource` rewritten**:
  - import line: `import * as migration_${i} from ${JsLiteral.modulePath(m.absolutePath)};`
    (was raw single-quoted `'${m.absolutePath}'`). register lines interpolate only numeric
    `migration_${i}` (safe). `// Source directory:` comment strips newlines (`/[\r\n]+/g`→' ').
  - **Dynamic-import allow-list**: generated runtime now emits
    `const ALLOWED_PROVIDERS = ['postgres','mysql','mssql'];` + guard before
    `await import(\`@ts-linq/provider-${providerName}\`)` (DB_PROVIDER env var can no longer
    select an arbitrary module). List mirrors `runEsbuild.external` + default `'postgres'`.
- **`script/idempotent-emitter.ts` hardened**:
  - new module consts `VERSION_PATTERN=/^\d{14}$/`, `NAME_PATTERN=/^[A-Za-z0-9_]+$/`.
  - `assertValidStep(step)` guard called at top of `buildStatements` (covers emit + emitStatements);
    throws **`BundleBuildError`** (reused from @ts-linq/types task-4; §16 reuse-before-invent;
    task explicitly permitted it) with `details:{version,name,reason:'invalid-migration-identifier'}`.
  - all 5 raw `'${step.version}'`/`'${step.name}'` sites → `QuoterFactory.for(dialect).literal(...)`
    (pgBlock INSERT+WHERE, mssqlBlock INSERT+WHERE, mysqlStatements INSERT). For valid ids output is
    byte-identical (literal wraps `'…'`, `'`→`''`) so existing `toContain("'…'")` stay green.
  - `__migrations` shared schema: already converged by task-2 (consumes `runner/MigrationsTableSchema`);
    only one literal `'__migrations'` exists (in MigrationsTableSchema) — confirmed, no change needed.

## Tests
- NEW `tests-new/bundle/codegen/JsLiteral.test.ts` — modulePath POSIX-normalizes Windows paths,
  escapes quote/double-quote/space, round-trips via JSON.parse; string escapes quotes/backslash/newline.
- extended `tests-new/script/idempotent-emitter.unit.test.ts` — matrix(3 dialects × 5 malformed
  steps incl. `"Bad'Name"`, `"2024'OR'1"`) → BundleBuildError + code OrmErrorCode.BundleBuild +
  details; valid step still emits single-quoted literals (3 dialects). (minor lint warning
  max-lines-per-function on the big describe — pre-existing style noise, 0 errors.)
- extended `tests-new/bundle/build-bundle.unit.test.ts` — reaches private discoverMigrations +
  generateEntrySource (no esbuild needed): asserts JSON-escaped POSIX specifier, NO raw
  single-quoted path import, adversarial dir `weird ' dir` round-trips, allow-list guard present
  and precedes `await import`.

## Validation — ALL GREEN
typecheck ✅, lint ✅ (0 err), test:unit ✅ 3550, integration ✅ 461, e2e ✅ 290, build ✅,
arch:deps/cycles/dead ✅. (rebuild @ts-linq/types dist before targeted jest — emitter imports BundleBuildError.)

## Changeset
`@ts-linq/migrations` **patch** 2.7.0→2.7.1 (security; public sigs retained, JsLiteral internal);
cascade patch to orm + cli. Security note in summary.

## Follow-ups
- task-7 still dedupes MigrationHandlers/TableHandlers unique-constraint branches.
- Boundary smell persists: migrations re-implements dialect SQL/quoting (task-6 area).
- **migrations now: task-1,2,3,4 ✅ done; remaining = task-5 (snapshot builders), task-6
  (dialect-inspector factory), task-7 (MigrationHandlers cleanup).**
