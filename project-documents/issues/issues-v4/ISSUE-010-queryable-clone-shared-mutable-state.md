# ISSUE-010: Mutable Shared State in Queryable.clone()

## Severity

High

## Category

- SOLID
- Testability
- Maintainability

## Location

- `packages/query/src/Queryable.ts:138-170` (clone method)
- `packages/query/src/Queryable.ts:56-57` (`_throttle` declaration)

## Problem

`Queryable.clone()` creates a new `Queryable` instance that shares mutable objects by reference with the original:

**1. `_throttle` shared by reference (intentional but dangerous):**
```ts
// line 155-156
// share throttle state by reference so all clones in a chain see the same counters
clonedQueryable._throttle = this._throttle;
```
The throttle object contains mutable counters (`windowStart`, `usedInWindow`, `lastAttemptAt`). Any clone in a query chain that mutates throttle state affects all other clones sharing the same reference. In a concurrent scenario where multiple clones are executing simultaneously (e.g., fallback racing), mutations to throttle state are not thread-safe.

**2. `_fallbacks` shallow spread:**
```ts
// line 154
clonedQueryable._fallbacks = [...this._fallbacks];
```
The array itself is a new reference, but the fallback objects inside it are shared. If a fallback object carries mutable state (e.g., last-used timestamp, circuit breaker state), clones share those mutations.

**3. `_executor` re-created with shared throttle:**
```ts
// line 158-165
clonedQueryable._executor = new QueryExecutor<T>(
  ...
  clonedQueryable._fallbacks,  // new array but same inner objects
  clonedQueryable._throttle    // same reference
);
```
The executor is re-created but receives both the shallow-copied fallbacks and the shared throttle reference.

## Evidence

`packages/query/src/Queryable.ts:56`:
```ts
private _throttle: FallbackThrottleState = { ... };
```

`packages/query/src/Queryable.ts:155-157`:
```ts
// share throttle state by reference so all clones in a chain see the same counters
clonedQueryable._throttle = this._throttle;
```

The comment confirms the sharing is intentional but the consequences (concurrent mutation, test isolation impossibility) are not addressed.

## Why It Matters

- **Correctness**: In concurrent query chains (hedging), two clones racing on the same throttle object may corrupt each other's window counters.
- **Testability**: A test that clones a `Queryable` and exercises fallback logic will unintentionally affect the original's throttle state.
- **Immutability contract**: Fluent APIs are typically expected to be immutable (each call returns an independent copy). Sharing mutable state between clones violates this expectation silently.
- **Debugging**: Diagnosing unexpected throttling behavior requires understanding which clone mutated the shared state — non-obvious from reading consumer code.

## Recommended Fix

1. **Make `FallbackThrottleState` explicitly immutable at the type level**, or deep-clone it in `clone()`:
   ```ts
   clonedQueryable._throttle = { ...this._throttle };
   ```
2. **Document the shared-throttle contract** if intentional: add a JSDoc explaining that all clones in a chain are intentionally rate-limited together.
3. **Deep-clone fallback objects** if they carry mutable state, or document that they must be stateless.
4. Consider making `fallbackTo()` return a new `Queryable` with an appended immutable fallbacks list, rather than mutating `_fallbacks` in place.

## Acceptance Criteria

- Either `_throttle` is deep-cloned in `clone()`, or the shared-throttle design is explicitly documented with a rationale and concurrency safety analysis.
- Fallback objects either have no mutable state or are deep-cloned when `clone()` is called.
- A unit test demonstrates that modifying throttle state on one clone does not affect an independent clone.
