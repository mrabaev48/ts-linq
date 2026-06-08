# refactor metadata/task-4 — getEntity silent-swallow → capability probe + typed error

**Status:** ✅ completed. Branch `refactor/metadata-getentity-reflect-fallback`. `patch` changeset for `@ts-linq/metadata`.

## What changed (`packages/metadata/src/MetadataRegistry.ts`)
- Removed the control-flow `try/catch` in `getEntity`. The old `catch {}` silently fell back to a
  second resolution path that skipped `target`-rebasing (`original !== target ? {...meta, target} : meta`)
  — a behavioural divergence with no signal. That fallback was also effectively dead code
  (the reflect probe never throws; `normalizeTarget` uses the same probe; a `finalizeEntity`/`build()`
  throw would just rethrow in the catch).
- `getEntity` is now a single guarded path (guard clause for falsy/non-function target) that always
  applies `target` rebasing → both wrapper and original targets yield the same metadata shape.
- Extracted `protected resolveOriginal(target): Function` — the wrapper→original resolver using the
  single capability probe (`reflectGetOwnMetadata('orm:original', target)`). Never throws for control
  flow. `protected` (not `private` as task suggested) so tests can subclass-inject a throwing resolver.
- Added `private resolveTarget(target): { original, key }` — a **translation-only** seam (always
  rethrows, never falls back): wraps `resolveOriginal` + `state.normalizeTarget`; an already-typed
  `OrmError` propagates unchanged, anything else is wrapped in `MetadataError(msg, { cause, details })`.

## Typed-error decision
Reused existing `MetadataError` (code `METADATA_ERROR`) from `@ts-linq/types` — **no new
`REFLECT_UNAVAILABLE` code added** (none needed; task allowed reuse). `metadata` depends only on
`@ts-linq/types`, so the `import { MetadataError, OrmError }` is boundary-clean.

## reflectUtils.ts
Code unchanged; only TSDoc hardened: `reflectGetOwnMetadata` is documented as **the single**
capability probe — `undefined` means "no reflect-metadata available / no entry for this key".

## Tests
New `packages/metadata/tests/MetadataRegistry.getEntity.test.ts` (6 tests): guard clauses; wrapper
rebasing via `Reflect.defineMetadata('orm:original', Original, Wrapper)`; no-reflect environment
(temporarily `delete Reflect.getOwnMetadata`); error-path (subclass overriding `resolveOriginal` to
throw → `MetadataError` with `.cause`); typed `OrmError` (ValidationError) propagates un-wrapped.

## Validation (all green)
typecheck, lint (0 errors), test:unit (3024), test:integration (464 + 2 skipped), test:e2e (290),
build, arch:deps, arch:cycles, arch:dead, and `pnpm run test:all`.

## Follow-up / tech debt
`metadata/task-5` still pending (last metadata task): `Function`-typed registry keys + `as unknown as`
casts (see the `task-5:` comment on the rebasing line). Out of scope here. `metadata` stays
🔄 In Progress until task-5; do NOT advance the next package (`ast`) before then.
See also [[refactor/metadata/task-2-registry-facet-split]], [[refactor/types-task-2-error-hierarchy]].
