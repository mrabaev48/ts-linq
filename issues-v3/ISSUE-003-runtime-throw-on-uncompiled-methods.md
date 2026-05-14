# ISSUE-003: Public API Methods That Always Throw at Runtime Without Transformer

## Severity

High

## Category

- Public API
- Clean Architecture
- Documentation Drift

## Location

- `packages/query/src/Queryable.ts` — lines 285–296, 379–389, 527–543, 222–251
- `packages/transformer/` — compile-time ts-patch plugin
- Root `package.json` / `tsconfig.json` — no enforced transformer requirement at package install time

## Problem

Four public methods on `Queryable<T>` — `where()`, `select()`, `having()`, `innerJoin()` (with predicate), and `leftJoin()` (with predicate) — always throw a runtime `Error` unless the compile-time transformer is active:

```typescript
public where(predicate: (entity: T) => boolean): Queryable<T> {
  throw new Error(
    "ts-linq(where): compile-time transformer is required. Configure ts-patch plugin '@ts-linq/transformer'."
  );
}
```

These methods exist in the public API to give the TypeScript compiler a target for the transformer to rewrite. But from a consumer's perspective, they appear to be callable methods. There is no type-level indication that they require a build-tool plugin.

### Why This Is an Architectural Problem

The contract between the library's public API and its actual behaviour depends on a **build-tool side-effect** that is invisible in the type system and not enforced by the npm package. A consumer can:

1. Add `ts-linq` as a dependency
2. Call `queryable.where(u => u.active)` — a valid TypeScript expression
3. Receive a runtime exception with no compile-time warning

The transformer's absence is not a type error; it is a silent runtime failure. The dependency on `ts-patch` and the transformer plugin is a **hidden environmental prerequisite** that leaks into the public contract.

## Evidence

```typescript
// packages/query/src/Queryable.ts:285
public where(predicate: (entity: T) => boolean): Queryable<T> {
  throw new Error(
    "ts-linq(where): compile-time transformer is required. ..."
  );
}

// packages/query/src/Queryable.ts:379
public select<TResult>(_selector: (entity: T) => TResult): Queryable<TResult> {
  throw new Error(
    "ts-linq(select): compile-time transformer is required. ..."
  );
}

// packages/query/src/Queryable.ts:527
public having(predicate: (entity: T) => boolean): Queryable<T> {
  throw new Error(
    "ts-linq(having): compile-time transformer is required. ..."
  );
}

// packages/query/src/Queryable.ts:228
// innerJoin with predicate variant
throw new Error("ts-linq(innerJoin): runtime predicate parsing is not supported. ...");
```

Meanwhile, `whereIn()`, `whereCompiled()`, `whereExists()`, `groupBy()`, `orderBy()` and others work normally at runtime. The API surface appears uniform but half of it is a transformer stub.

## Why It Matters

- **API stability risk**: Consumers cannot discover this constraint from the type system or IntelliSense.
- **Testing risk**: Unit tests for application code that calls `where()` will fail at runtime unless the test runner is also configured with ts-patch — a non-trivial setup requirement.
- **Documentation drift**: The README/docs must be relied upon to communicate a constraint that belongs in the type contract.
- **Coupling risk**: The library's correctness is coupled to a specific build pipeline, not just a runtime dependency graph.

## Recommended Fix

Option A — **Type-level enforcement**: Use a conditional type or branded type marker to prevent calling `where()` unless the result of a transformer-aware type is present. This is complex but surfaces the constraint at compile time.

Option B — **Separate API surface**: Expose `whereCompiled()` / `selectCompiled()` as the stable public API. Mark `where()` / `select()` as `@internal` and document that they are transformer targets only, not consumer-facing APIs. Provide a lint rule or eslint plugin that warns on direct calls to the stub methods.

Option C — **Runtime fallback interpreter**: Implement a limited runtime expression interpreter for simple predicates (property equality, AND/OR, null checks) so that `where()` works without the transformer for basic cases, degrading gracefully.

Preferred: Option B (minimal change, maximum clarity) combined with documentation clearly listing transformer setup as a prerequisite in package-level `README` and in the `@ts-linq/query` package itself.

## Acceptance Criteria

- `where()`, `select()`, `having()` are either callable at runtime for basic cases OR are not part of the consumer-facing public API surface
- The type system or a lint rule prevents direct calls to transformer-stub methods
- Package README clearly states transformer as a prerequisite with setup instructions
- Integration tests cover the "transformer not configured" scenario and produce a meaningful error/diagnostic
