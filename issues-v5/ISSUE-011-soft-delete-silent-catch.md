# ISSUE-011: `DbContext` constructor silently swallows configuration errors

## Severity

Low

## Category

- Clean Code
- Testability
- Maintainability

## Location

- `packages/orm/src/DbContext.ts:81-85` — soft-delete configuration `try/catch {}`
- `packages/orm/src/DbContext.ts:167-174` — query-analysis configuration `try/catch {}`
- `packages/orm/src/DbContext.ts:89-97` — memory-profiler start `try/catch {}` (with commented-out logger call)

## Problem

The `DbContext` constructor wraps three provider-configuration calls in `try/catch` blocks with empty (or commented-out) bodies:

```ts
// 81-85
try {
  this._provider.configureSoftDelete(options.softDelete);
} catch {
  /* ignore */
}
// ...
// 167-174
try {
  const analysis = options.performance?.analysis;
  if (analysis) {
    this._provider.configureQueryAnalysis(analysis);
  }
} catch {
  /* ignore */
}
// 89-97
try {
  const mp = this._diagnostics?.memoryProfiler;
  if (mp) {
    this._memoryProfiler = mp;
    mp.start?.();
  }
} catch (e) {
  // logInternalError('DbContext.constructor.memoryProfiler.start', e);
}
```

Each pattern is justified by a **defensive assumption** about the provider implementing optional methods (e.g. `configureSoftDelete`, `configureQueryAnalysis`). That assumption is the problem:

1. If `configureSoftDelete` is missing on a provider, the right fix is to make it optional in the **type** of `DatabaseProvider` (or have a default no-op base class), not to swallow `TypeError: ... is not a function` at the call site.
2. If the call exists but throws because of a misconfigured option (e.g. invalid column name in `options.softDelete.softDeleteColumn`), the user's misconfiguration is silently lost — the `DbContext` constructs successfully and queries later produce surprising behaviour (soft-delete filter not applied).
3. The memory-profiler `catch (e) { /* logInternalError(...) */ }` is dead-coded — the logger call was commented out, leaving an unreachable catch with a TODO-shaped comment.

## Evidence

- `packages/orm/src/DbContext.ts:81-85`, `:89-97`, `:167-174` — three distinct silent catches in the constructor.
- `packages/core/src/types/index.ts` defines `DatabaseProvider` / `IDatabaseProvider` — `configureSoftDelete` and `configureQueryAnalysis` should either be required, optional with a `?:`, or moved into a separate optional capability interface.
- No log call, no opt-in mode, no test fixture exercising the catch branches.

## Why It Matters

- **Hidden failure modes**: A user mistypes `softDeleteColumn` and the soft-delete filter is silently inactive. Tests against in-memory data pass; production data is mutated incorrectly.
- **Test gap**: No reasonable test can fail when an exception is swallowed unconditionally. The catches are also barriers to fuzz-testing the configuration surface.
- **API discoverability**: The `try/catch` strongly implies "this method may or may not exist" — a contract that should live in the type system, not in defensive runtime code.

## Recommended Fix

1. Make the optional-capability nature explicit in the type:
   ```ts
   // in @ts-linq/core
   interface SoftDeleteConfigurable {
     configureSoftDelete(opts: SoftDeleteOptions | undefined): void;
   }
   interface QueryAnalysisConfigurable {
     configureQueryAnalysis(opts: QueryAnalysisOptions): void;
   }
   ```
   The provider implements (or doesn't implement) these — `DbContext` does a `typeof this._provider.configureSoftDelete === 'function'` check explicitly, without `try/catch`.
2. Remove the `try/catch` wrappers; let configuration errors propagate. Construction failure is preferable to silent misconfiguration.
3. Delete the dead `try/catch (e) { /* logInternalError(...) */ }` for the memory profiler. If logging is wanted, re-enable the call; otherwise drop it.
4. Add a unit test asserting that invalid `softDelete` / `analysis` options cause `new DbContext(...)` to throw with a descriptive message.

## Acceptance Criteria

- `packages/orm/src/DbContext.ts` contains zero `catch {}` / `catch (_) {}` / `catch (e) { /* ... */ }` blocks in the constructor.
- Optional provider capabilities are declared via interfaces, not detected via `try/catch`.
- A unit test exercises misconfigured `softDelete` options and asserts a thrown error.
- `pnpm typecheck && pnpm test:unit && pnpm test:integration` green.
