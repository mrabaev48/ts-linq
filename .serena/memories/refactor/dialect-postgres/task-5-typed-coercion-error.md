# dialect-postgres / task-5 — Typed parameter-coercion error (✅ completed)

**Branch:** `audit-refactor/dialect-typed-coercion-error` → PR to `main`.

## Problem
Shared `coerceSqlParameter` (packages/dialect-kit/src/params/coerce.ts, single source since task-4)
had `try { JSON.stringify(value ?? null) } catch { return String(value) }`. A circular ref produced
`"[object Object]"` bound as a SQL parameter — silent data corruption, no diagnostic.

## Fix
1. **New error** `ParameterCoercionError` in `@ts-linq/types/errors.ts`:
   - extends `OrmError` directly (coercion-boundary error, NOT a `DatabaseError` subtree).
   - new `OrmErrorCode.ParameterCoercion = 'PARAMETER_COERCION_ERROR'` (added after `DbUpdateConcurrency`).
   - constructor `(message, opts?)`; carries `details.property` + preserved `cause`; user-safe message
     (`Failed to coerce parameter for property '<name>' to a driver-safe value`).
   - **Manifest updated in 4 places:** barrel `src/index.ts` export block; `src/__tests__/exports.check.ts`
     (import + `new ParameterCoercionError('test')`); `tests/type-exports.test.ts` (`toBeDefined` +
     strict `Object.keys` allowlist `expectedExports` — MUST be added or test fails); `src/__tests__/errors.test.ts`
     (code + instanceof/cause/details assertions).
2. **coerce.ts** now `coerceSqlParameter(value, property?)`:
   - `catch (cause) { throw new ParameterCoercionError(msg, { cause, details: { property } }) }` — no silent fallback.
   - **BigInt decision (mandatory, not optional):** explicit `if (typeof value === 'bigint') return value.toString()`
     BEFORE the JSON try. Rationale: `JSON.stringify(bigint)` throws → old catch used to rescue it via
     `String()` = "1". Removing the catch without this would regress bigint params to throwing —
     backward-compat break (CLAUDE.md priority #6). Now only genuine non-serializable values (circular
     refs) throw.
3. **Thread-everywhere (user-chosen blast radius):** identifier passed as 2nd arg at all ~34 call sites
   across 6 files — PostgresDialect/MssqlDialect/MysqlDialect + their 3 batch-syntax.ts. Pattern:
   `entity[c.propertyName]→c.propertyName`, `entity[pk]→pk`, `origVal→col.propertyName`,
   versionCol→`versionCol.propertyName`.

## Build gotcha
dialect-* typecheck against the **built dist** of dialect-kit. After changing the signature you MUST
`pnpm --filter @ts-linq/dialect-kit build` (and `@ts-linq/types build`) before repo `pnpm typecheck`,
else dialects report `TS2554 Expected 1 arguments, but got 2`.

## Out of scope (tech debt)
Other silent `String(value)` coercion copies remain OUTSIDE dialect-kit and were intentionally not
touched (task-5 scope = dialect-kit/dialect-*): `core/src/utils/SqlHelper.ts`,
`provider-postgres/PostgresProvider.ts`, `provider-mssql/MssqlProvider.ts`,
`provider-mysql/MySqlProvider.ts`, `query/src/SetPropertyCalls.ts`. Candidate follow-up sweep.

## Validation (all green)
typecheck ✓ · lint ✓ (0 err) · test:unit ✓ (3903) · test:integration ✓ (461) · test:e2e ✓ (290) ·
build ✓ · arch:deps ✓ · arch:cycles ✓ · arch:dead ✓. Note real script names are `test:unit/integration/e2e`
(not the pluralized `tests:*` in CLAUDE.md).

## Changeset
`@ts-linq/types` **minor** (new ParameterCoercionError + OrmErrorCode literal),
`@ts-linq/dialect-kit` **patch** (data-corruption fix: coercion now throws instead of degrading).
