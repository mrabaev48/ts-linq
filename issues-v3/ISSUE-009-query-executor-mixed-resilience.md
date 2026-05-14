# ISSUE-009: `QueryExecutor` Mixes Four Distinct Resilience Responsibilities

## Severity

Medium

## Category

- SOLID
- Maintainability
- Testability

## Location

- `packages/query/src/QueryExecutor.ts` (438 lines)

## Problem

`QueryExecutor` handles the following distinct concerns within a single class:

1. **Primary query execution** — calls `DatabaseProvider.executeQuery()`, materializes rows
2. **Fallback source iteration** — loops through registered `QueryFallback<T>` sources in order
3. **Hedged racing** — races the primary source against a fallback with a configurable delay (`Promise.race`)
4. **Throttling** — prevents fallback overuse via per-chain throttle state (shared by reference across `Queryable` clones)

These are four separate resilience patterns, each with its own configuration, failure modes, and testability requirements. Embedding all four in one class makes it impossible to test any one of them without exercising all the others.

## Evidence

`QueryExecutor` contains methods that map to each concern:

- Primary execution: `executeQuery()` or equivalent top-level dispatch
- Fallback iteration: logic that tries each `QueryFallback<T>` from `_fallbacks` array
- Hedged race: `Promise.race([ primaryPromise, delay(n).then(() => fallbackPromise) ])`
- Throttling: references to `_throttleState` shared object

```typescript
// packages/query/src/QueryExecutor.ts:50
(model as unknown as { cte?: CteDefinition }).cte = cte; // also mutates QueryModel (see ISSUE-010)

// packages/query/src/QueryExecutor.ts:65
(winner.rows as unknown as T[]).slice() // hedged race winner extraction

// packages/query/src/QueryExecutor.ts:210
return { rows: data as unknown as ReadonlyArray<unknown>, label: fb.label }; // fallback path
```

The throttle state is passed by reference from `Queryable.clone()` to `QueryExecutor`, creating an implicit coupling between the builder and the executor through shared mutable state.

## Why It Matters

- **Testability**: To test "hedged racing with a 100ms delay", the test must construct a full `QueryExecutor` with a provider, fallback sources, throttle state, and materialization logic. None of this is separable.
- **Maintainability**: Changing the hedging strategy (e.g., adaptive delay based on p95 latency) requires modifying the same class that handles basic primary execution.
- **SRP violation**: A change to throttle logic, fallback iteration, or hedging can accidentally break primary execution — they share the same code path.
- **Coupling risk**: The throttle state shared by reference between `Queryable` clones creates hidden coupling across the query builder and executor layers.

## Recommended Fix

Decompose into a strategy/chain-of-responsibility pattern:

```typescript
interface ExecutionStrategy<T> {
  execute(model: QueryModel, provider: DatabaseProvider): Promise<T[]>;
}

class DirectExecutionStrategy<T> implements ExecutionStrategy<T> { ... }
class FallbackExecutionStrategy<T> implements ExecutionStrategy<T> { ... }
class HedgedExecutionStrategy<T> implements ExecutionStrategy<T> { ... }
class ThrottledExecutionStrategy<T> implements ExecutionStrategy<T> { ... }
```

`QueryExecutor` becomes a compositor that selects and chains strategies based on configuration:

```typescript
class QueryExecutor<T> {
  constructor(private strategy: ExecutionStrategy<T>) {}
  execute(model: QueryModel): Promise<T[]> { return this.strategy.execute(model, this.provider); }
}
```

This allows unit testing each strategy independently with a mock `DatabaseProvider`.

Incremental steps:
1. Extract fallback iteration into `FallbackChain`
2. Extract hedged race into `HedgedStrategy`
3. Move throttle tracking into `FallbackThrottle`
4. `QueryExecutor` orchestrates these collaborators

## Acceptance Criteria

- `QueryExecutor.ts` is under 200 lines (orchestration only)
- Each resilience strategy has its own unit tests
- Throttle state is not passed by reference across `Queryable` clones
- Primary execution path is testable without configuring fallback or hedging
