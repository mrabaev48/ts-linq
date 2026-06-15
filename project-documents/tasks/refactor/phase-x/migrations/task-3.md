---
status: completed
phase: phase-x
package: migrations
priority: P0
effort: M
risk: high
category: sql
depends_on: ["task-1.md"]
related: ["task-2.md"]
---

# Refactor: Safe bundle and idempotent-script code generation

## Problem

Two code-generation paths build executable code / SQL by raw string concatenation,
interpolating file paths and migration metadata directly into the output. Both produce
artifacts that an operator later executes (a Node bundle, an `.sql` script), so an unsafe
interpolation becomes arbitrary-code or arbitrary-SQL execution.

## Evidence

- `packages/migrations/src/bundle/build-bundle.ts:103-104` — generates
  `import * as migration_${i} from '${m.absolutePath}';` by interpolating an absolute
  filesystem path into a single-quoted JS import. On Windows the backslashes are invalid
  escapes; a path containing `'` injects into the generated module.
- `packages/migrations/src/bundle/build-bundle.ts:149-151` — generated runtime does
  `await import(\`@ts-linq/provider-\${providerName}\`)` where `providerName` comes from an
  env var at *bundle runtime* — unvalidated dynamic import target.
- `packages/migrations/src/script/idempotent-emitter.ts:163-165,173,190-192,197-198,
  232-234` — interpolates `step.version` and `step.name` directly into SQL string
  literals: `VALUES ('${step.version}', '${step.name}', NOW()::TEXT)` and
  `WHERE version = '${step.version}'`. A migration name containing `'` breaks the
  generated guard block (the names come from filenames, but the format regex is only
  enforced elsewhere, not here).
- `packages/migrations/src/bundle/build-bundle.ts:189-193` — `catch {}` around the dynamic
  `esbuild` import is a valid translation-wrapping catch (re-throws a helpful error); kept,
  but noted for completeness.

## Why this is bad

- **Arbitrary execution:** the bundle emits an executable `.mjs`; an injected path/literal
  becomes code the operator runs.
- **Cross-platform breakage:** raw absolute paths in single-quoted imports are not
  Windows-safe.
- **Inconsistent safety:** task-1 fixes builder SQL, but these two generators bypass the
  builder layer entirely and re-introduce raw interpolation.

## Target architecture

Apply **Clean Code** ("don't build code with `+`") and reuse the task-1 quoting layer for
the SQL side; for the JS side, use a structured emission step that escapes path/string
literals.

- Introduce a tiny `JsLiteral.string(value)` / `JsLiteral.modulePath(path)` helper that
  JSON-encodes strings (so quotes/backslashes are escaped) and normalizes paths to POSIX
  separators for `import` specifiers.
- Route every interpolated identifier/path in `generateEntrySource` through it.
- Route `step.version`/`step.name` in the idempotent emitter through the task-1 `literal()`
  encoder (single-quote escaping) and validate them against the migration-name format
  before emission (fail fast with a typed error rather than emit broken SQL).
- Validate `providerName` against an allow-list before the dynamic import in the generated
  runtime.

## Proposed refactor

1. Add `bundle/codegen/JsLiteral.ts` with `string()`/`modulePath()` (JSON.stringify-based).
2. Rewrite `generateEntrySource` import + register lines to use it; normalize
   `m.absolutePath` to POSIX for the specifier.
3. In `idempotent-emitter`, replace raw `'${step.version}'`/`'${step.name}'` with the
   task-1 literal encoder and add a guard that rejects names not matching
   `/^[A-Za-z0-9_]+$/` / versions not matching `/^\d{14}$/`.
4. In the generated runtime, constrain `providerName` to `postgres|mysql|mssql` (or the
   declared external list) before `await import`.

Public API: `MigrationBundleBuilder.build` and `IdempotentEmitter.emit/emitStatements`
keep their signatures.

## Suggested design patterns

- **Builder + Encoder separation** — emit structure, encode leaves through a dedicated
  encoder. Why: removes ad-hoc interpolation; one place to audit escaping.
- **Guard clause / fail-fast validation** — reject malformed version/name before emission.
  Why: never emit broken or injectable SQL/JS.
- **Allow-list validation** for the dynamic import. Why: prevents loading arbitrary modules
  from an env var.

## Testing plan

- **Unit:** `JsLiteral.modulePath` produces POSIX, escaped specifiers for Windows-style and
  quote-containing paths.
- **Unit:** idempotent emitter rejects a step whose `name`/`version` is malformed and
  escapes any literal it does emit.
- **Regression:** existing `script/idempotent-emitter.unit.test.ts` and
  `bundle/build-bundle.unit.test.ts` still pass (extend with adversarial inputs).
- **Integration (optional):** generated bundle entry source parses (e.g. via `esbuild`
  transform) for a path containing a space/quote.

## Acceptance criteria

- [ ] No raw path/string interpolation in `generateEntrySource`; all leaves are encoded.
- [ ] Import specifiers are POSIX-normalized and JSON-escaped.
- [ ] `idempotent-emitter` escapes version/name and rejects malformed values up front.
- [ ] Generated runtime validates `providerName` against an allow-list.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Land task-1 (literal encoder) first; reuse it for the SQL side.
2. Add `JsLiteral` and migrate the bundle generator.
3. Harden the idempotent emitter and the dynamic-import allow-list.

## Notes

The same idempotent-emitter cleanup should adopt the shared `__migrations` schema constant
from task-2 so the three definitions converge.
