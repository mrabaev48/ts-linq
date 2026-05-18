# ISSUE-001: DbContext constructor returns a Proxy and bypasses the type system

## Severity

High

## Category

- Type System
- Clean Architecture
- Public API
- Testability

## Location

- `packages/orm/src/DbContext.ts:195-211` — Proxy returned from constructor
- `packages/orm/src/DbContext.ts:76-212` — entire constructor

## Problem

`DbContext`'s constructor returns a `Proxy` wrapping `this`, cast as `as unknown as this`:

```ts
return new Proxy(this, {
  set(target: DbContext, prop: string | symbol, value: unknown): boolean {
    if (typeof prop === 'string' && value instanceof DbSet) {
      value._injectContext(dbSetCtx);
      dbSetsMap.set(value.entityClass, value as DbSet<object>);
      Object.defineProperty(target, prop, { value, writable: true, enumerable: true, configurable: true });
      return true;
    }
    return Reflect.set(target, prop, value);
  }
}) as unknown as this;
```

The constructor's responsibility (initialise object state) is overloaded with implementing a DSL feature ("EF-Core property initialiser syntax"). Returning a `Proxy` from a constructor is technically legal in ES, but:

1. It silently breaks the contract that `new X()` returns an instance of `X` (the actual object reachable via subclass property reads is the Proxy, not the `this` that ran through the constructor body).
2. The cast `as unknown as this` is a deliberate hole in the type system — TypeScript would otherwise reject `Proxy<DbContext>` as `this`.
3. Subclass logic in property initialisers (which fire *after* `super()` returns) reaches the Proxy, but methods inside the constructor body run against the un-Proxied `this`. The two halves of a subclass execute against different objects.
4. The Proxy is unconditionally allocated for every `DbContext` instance even when the user did not opt into the "property initialiser" pattern (i.e. when they call `this.set(Entity)` manually). This is non-zero per-request overhead in hot-path tests/server scenarios where contexts are created per unit-of-work.

## Evidence

- `packages/orm/src/DbContext.ts:189-211` — constructor body comment explicitly states "Subclass property initializers run after super() returns — this Proxy intercepts those assignments…"
- The `set` trap also calls `Object.defineProperty(target, prop, …)` to override the getter created by `initializeDbSets()` (line 187) — so the same `DbSet` slot is configured twice (once as a getter, then once as a data property).
- Any code that does `if (ctx instanceof DbContext)` against an `instance.someMethodReturningCtx()` value still works (Proxy preserves the prototype), but `Object.getPrototypeOf(ctx) === DbContext.prototype` and `Object.is(this, returnedCtx)` inside the constructor do not.
- The `as unknown as this` cast (line 211) is the only one of its kind in `packages/orm/src/`.

## Why It Matters

- **Type-safety risk**: The double cast is a permanent invitation to drift — future maintainers can return any object shape from the constructor and TypeScript will not catch it.
- **Testability**: Mocking `DbContext` (e.g. via `jest.spyOn(ctx, ...)`) now targets the Proxy, not the real instance — spies on protected fields don't fire as expected because `Reflect.set` on the Proxy is not what mocking libraries instrument.
- **Coupling**: The constructor mixes lifecycle (provider/caches/services initialisation, ~115 lines) with a property-injection DSL. Two distinct responsibilities are entangled.
- **Performance**: Per-context Proxy allocation cost is paid by every consumer, including those who do not use the "new DbSet(Entity)" property-initialiser pattern.
- **Inheritance**: Multi-level subclasses (`class AppCtx extends BaseCtx extends DbContext`) have to reason about a Proxy boundary that crosses each `super()` return — this is undocumented in the JSDoc.

## Recommended Fix

Separate the DSL feature from the constructor.

1. Replace the Proxy-from-constructor pattern with an explicit `init()` step or a `defineSet()` helper, e.g.:
   ```ts
   class AppCtx extends DbContext {
     users = this.defineSet(User);   // instead of `new DbSet(User)`
   }
   ```
   `defineSet()` returns a fully-injected `DbSet<T>` synchronously without needing a Proxy.

2. If the `new DbSet(Entity)` property-initialiser syntax must be preserved, implement injection via a one-shot post-construction hook: have the subclass call `this.bind(this)` at the end of its own constructor, or run injection lazily inside `DbSet`'s first method invocation (it already has `_injectContext`).

3. Eliminate the `as unknown as this` cast entirely. The constructor should return `this` implicitly.

## Acceptance Criteria

- `DbContext` constructor no longer returns a Proxy and contains no `as unknown as this` cast.
- `new DbContext(opts) instanceof DbContext` holds, and the value is `===` to `this` inside the constructor.
- The "property-initialiser DSL" works through an explicit mechanism (helper, decorator, or post-construction call) — covered by unit tests.
- A unit test asserts that subclass property initialisers receive context (regression coverage).
- `pnpm typecheck && pnpm test` remain green.
