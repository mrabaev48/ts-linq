# ISSUE-005: `resolveTargetCtor()` accepts any function as a constructor

## Severity

Medium

## Category

- Type System
- Clean Code
- Maintainability

## Location

- `packages/query/src/IncludePlanner.ts:70-86` — top-level `resolveTargetCtor` function

## Problem

`resolveTargetCtor()` turns a `string | Function | (() => Function)` into "a constructor" via two unguarded casts and a swallowing `try/catch`:

```ts
function resolveTargetCtor(
  target: string | Function | (() => Function)
): (new () => unknown) | null {
  if (typeof target === 'string') return null;
  if (typeof target === 'function') {
    if ('prototype' in target && (target as { prototype?: unknown }).prototype) {
      return target as new () => unknown;             // (1) cast
    }
    try {
      const resolved = (target as () => Function)();  // (2) cast + invoke
      return resolved as new () => unknown;           // (3) cast
    } catch {
      return null;                                    // (4) swallow
    }
  }
  return null;
}
```

Problems:

1. **No runtime constructor check**. `prototype` truthiness is a heuristic, not a guarantee that calling `new target()` will work. Arrow functions have no `prototype`, but a regular function used as a non-constructor (e.g. `function getThing() { return ...; }`) has one — it passes the heuristic and is later invoked with `new` somewhere downstream, throwing in user code rather than here.
2. **No check on the lazy-factory return**. `(target as () => Function)()` is invoked and its result is cast as `new () => unknown` without verifying it is actually constructible. A factory that returns `{}` is accepted.
3. **`try/catch` swallows real errors**. If the lazy factory throws because of a misconfiguration (e.g. circular import that isn't yet initialised), the user sees "include path silently produced no data" (compounding ISSUE-004). The catch should narrow on `ReferenceError` (TDZ / hoisting) or rethrow.
4. **Triple cast through `unknown`-like types**. `target as new () => unknown` / `resolved as new () => unknown` are stand-alone violations of `@typescript-eslint/no-unsafe-...` rules; they only pass lint because the project uses bare `as`.

## Evidence

- `packages/query/src/IncludePlanner.ts:74-77` — `'prototype' in target` heuristic.
- `packages/query/src/IncludePlanner.ts:79-83` — invocation + swallow.
- `packages/query/src/IncludePlanner.ts:5` — public `IncludePlanner` is re-exported from `packages/query/src/index.ts` (see ISSUE-006), so this helper sits one import away from user-land.

## Why It Matters

- **Silent breakage**: combined with ISSUE-004, this is the second silent-skip in the same code path. Two layers of "return null on failure" make the include feature feel like it works while quietly truncating data.
- **Cross-package coupling**: `resolveTargetCtor` mirrors a problem `@ts-linq/metadata` already has to solve internally (forward-ref resolution for circular imports). The fact that `IncludePlanner` duplicates this logic, with weaker checks, is a sign of a missing single source of truth.
- **Type-system erosion**: this file produces the only `as new () => unknown` casts in `packages/query/src/`. They will be copy-pasted as the pattern of choice unless replaced.

## Recommended Fix

1. Move forward-ref resolution into `@ts-linq/metadata` (e.g. add `resolveEntityCtor(target)` on `MetadataStorage`) and have `IncludePlanner` call it. The metadata package already owns entity-class registration and can do the check authoritatively.
2. Inside the resolver, validate the result:
   ```ts
   if (typeof resolved !== 'function' || !resolved.prototype) {
     throw new TypeError(`Forward-ref factory for relationship '${rel.propertyName}' returned non-constructor ${resolved}`);
   }
   ```
3. Distinguish two cases in the `try/catch`:
   - `ReferenceError` due to TDZ → throw with a clearer "circular import: declare the relationship with a `() => Entity` arrow" message.
   - Any other error → rethrow.
4. Remove the local `resolveTargetCtor` in `IncludePlanner` once the metadata helper is in place.

## Acceptance Criteria

- `packages/query/src/IncludePlanner.ts` no longer contains its own `resolveTargetCtor`.
- The metadata package exposes a single helper that performs the resolution and validation.
- A unit test covers: regular constructor, lazy factory, lazy factory returning a non-constructor (throws), lazy factory throwing `ReferenceError` (re-throws with helpful message).
- No `as new () => unknown` casts remain in `packages/query/src/`.
- `pnpm typecheck && pnpm test:unit` green.
