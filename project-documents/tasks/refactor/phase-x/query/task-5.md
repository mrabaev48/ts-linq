---
status: completed
phase: phase-x
package: query
priority: P1
effort: M
risk: medium
category: typescript
depends_on: []
related: []
---

# Refactor: Stop over-promising compile-time safety in `extractKey` lambda selectors

## Problem
`extractKey` (`Queryable.ts:1738-1760`) and `SetPropertyCalls.extractSingleProp`
(`SetPropertyCalls.ts:32-55`) use a runtime `Proxy` to recover a property name from a
selector lambda. The public signatures advertise lambda selectors —
e.g. `orderBy<K extends keyof T>(keyOrSelector: K | ((entity: T) => T[keyof T]))`
(`Queryable.ts:767`), `innerJoinOn(..., leftKey: (keyof T & string) | ((entity: T) =>
T[keyof T]), ...)` (`Queryable.ts:561-565`) — but the runtime **silently/forcibly rejects**
anything beyond a single top-level property:

- Nested access `u => u.profile.city` records two segments and **throws** at runtime
  (`extractKey` `:1752-1758`), even though the type system happily accepts it.
- The type `(entity: T) => T[keyof T]` is a **lie**: it claims the lambda returns a value of
  the union of all property value types, when in practice only the *first property access*
  matters and the return value is discarded.
- `thenInclude(selector: (nav: never) => unknown)` (`Queryable.ts:1118`) types the param as
  `never`, defeating IntelliSense entirely — the developer gets no completion and no
  type checking on the nested navigation.

## Evidence
- `extractKey` throws on multi-property selectors: `Queryable.ts:1752-1758`.
- `SetPropertyCalls.extractSingleProp` swallows proxy errors then throws a generic message:
  `SetPropertyCalls.ts:43-54`.
- `thenInclude` parameter typed `never`: `Queryable.ts:1118`.
- The same permissive `((entity: T) => T[keyof T])` selector type is repeated across
  `orderBy`, `orderByDescending`, `thenBy`, `thenByDescending`, `innerJoinOn`,
  `leftJoinOn`, `include` (`Queryable.ts:561, 587, 767, 790, 1026, 1788, 1803`).

## Why this is bad
- **Type-system erosion**: the compiler approves code that throws at runtime — the worst
  kind of API, because the failure mode is deferred to production.
- **Discoverability**: `never`-typed `thenInclude` gives zero IDE help.
- **Inconsistency**: docs (e.g. `Queryable.ts:758-766`) warn nested paths throw, but the
  *types* don't enforce it — documentation patching a type hole.

## Target architecture
Make the **types match the runtime contract** (type-first / "make illegal states
unrepresentable"):

- Replace `(entity: T) => T[keyof T]` with a precise single-key selector type, e.g.
  `<K extends keyof T>(selector: (e: T) => T[K])`, so the inferred `K` is the *specific*
  property and the return type is its real value type (enables downstream type-safe
  pagination keys, etc.).
- For `thenInclude`, thread the leaf navigation entity type through the include chain so the
  selector is typed against the actual nested entity (advanced generic propagation) — or, if
  full chain typing is out of scope, at minimum type it as a key of a generic `TNav` rather
  than `never`.
- Keep the runtime `Proxy` but treat a multi-segment access as a **typed compile error**
  where feasible, or document + throw consistently.

## Proposed refactor
1. Introduce `type KeySelector<T, K extends keyof T> = (e: T) => T[K]` and adopt it across
   the ordering/join/include selector overloads.
2. Add **type-level tests** (`.type-test.ts`) asserting that `orderBy(u => u.id)` infers the
   id type and that nested access is rejected or correctly typed.
3. Re-type `thenInclude` to use the include-chain leaf type (see `IncludeBuilder` in
   `query/task-1.md`); fall back to `keyof TNav` if chain typing is deferred.
4. Unify `extractKey` and `extractSingleProp` into one shared helper with one consistent
   error model (today they differ: one swallows proxy errors, one doesn't).

## Suggested design patterns
- **Type-first design / "make illegal states unrepresentable"** — *Why*: shift selector
  errors from runtime to compile time.
- **Parametric generics for inference preservation** — *Why*: recover the precise key type
  so chained APIs (keyset pagination) stay strongly typed.

## Testing plan
- **Type-level**: `tests-new/` `.type-test.ts` asserting selector inference + rejection of
  unsupported forms.
- **Unit**: shared `extractKey` helper — single-prop ok, multi-prop throws with the unified
  message, zero-prop throws.
- **Regression**: existing `extractKey.test.ts` stays green.

## Acceptance criteria
- [ ] Selector overloads use a precise `KeySelector<T, K>` type, not `T[keyof T]`.
- [ ] `thenInclude` no longer typed `(nav: never) => unknown`.
- [ ] `extractKey` and `extractSingleProp` share one helper + one error model.
- [ ] Type-level tests added covering inference and rejection.
- [ ] `extractKey.test.ts` green.

## Refactor order
Independent; best done alongside `IncludeBuilder` extraction in `query/task-1.md` for the
`thenInclude` chain typing.

## Notes
This is a public-API typing change — likely `minor` (more precise types) but verify no
downstream consumer relied on the looser signature.
