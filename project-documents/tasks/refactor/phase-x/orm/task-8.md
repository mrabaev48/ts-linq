---
status: not-started
phase: phase-x
package: orm
priority: P2
effort: S
risk: low
category: typescript
depends_on: []
related: ["task-3.md"]
---

# Refactor: Reduce `as unknown as` casts in the DbSet factory paths

## Problem

The DbSet creation/lookup paths use repeated double casts (`as unknown as
DbSet<T>`, `as unknown as Function`, `as unknown as new () => object`) to bridge
the runtime `Map<Function, DbSet<object>>` storage with the generic `DbSet<T>`
public return types. These bypass the type system at exactly the boundary where
type safety matters most (the typed-set accessor consumers rely on).

## Evidence

- `DbContext.ts:280` — `return this._dbSets.get(normalized) as unknown as DbSet<T>;`
- `DbContext.ts:287-290` — decorated set creation + `as unknown as DbSet<T>`.
- `DbContext.ts:315` — `return this._dbSets.get(original) as unknown as DbSet<T>;`
- `DbContext.ts:318-319` — `dbSet as unknown as DbSet<object>` +
  `original as unknown as Function`.
- `DbContext.ts:829-833` — `original as unknown as new () => object` and
  `_dbSets.set(original, dbSet)`.
- Related: `DbSet.ts:615-617` `toDictionaryAsync` overload bridge cast; project
  CLAUDE.md forbids introducing `any`/casts into public APIs and prefers
  `unknown`-free strongly typed builder patterns.

## Why this is bad

- `as unknown as X` defeats *all* checking; a wrong stored type would not be
  caught until runtime.
- The pattern is copy-pasted across five+ sites, so the unsafe bridge is
  load-bearing and easy to get subtly wrong.
- Erodes the "preserve type inference / avoid `any` in public APIs" guarantee the
  package advertises.

## Target architecture

Encapsulate the heterogeneous storage behind a typed `DbSetRegistry` (also
introduced in task-1) whose internal map is `Map<Function, DbSet<object>>` but
whose public methods are generic and perform the cast in **one audited place**:

```ts
class DbSetRegistry {
  private readonly sets = new Map<Function, DbSet<object>>();
  get<T extends object>(ctor: EntityCtor<T>): DbSet<T> | undefined { /* single cast */ }
  getOrCreate<T extends object>(ctor: EntityCtor<T>, make: () => DbSet<T>): DbSet<T>;
}
```

The cast is justified because `DbSet<T>` is invariant only over its `_entityClass`
field and is otherwise structurally erased at runtime; documenting and isolating
the single cast (with a `// safe: stored under its own ctor key` comment) replaces
five scattered unsafe casts.

## Proposed refactor

1. Introduce an `EntityCtor<T> = new () => T` alias to remove the
   `as unknown as Function` and `as unknown as new () => object` casts (use
   `Function` only at the `Map` key boundary, narrowed once).
2. Centralize all `_dbSets` access in `DbSetRegistry` (shared with task-1).
3. Reduce the public-facing casts to a single internal one inside the registry,
   documented.
4. For `getOriginal`/decoration normalization, type the metadata read so the
   `reflectGetOwnMetadata('orm:original', ...)` result is narrowed without the
   double cast where possible.

## Suggested design patterns

- **Typed repository/registry** — one place owns the unsafe storage bridge.
- **Branded/alias types** (`EntityCtor<T>`) — make constructor types explicit and
  remove `Function`-to-`new()` casts.

## Testing plan

- **Type-level (`test-d`):** `ctx.set(User)` infers `DbSet<User>`;
  `ctx.users` typed correctly; decorated-class path still typed.
- **Regression:** `tests-new/DbContextConstructor.test.ts`,
  `tests-new/DbContextProxy.test.ts`, `tests-new/DbSet.test.ts`,
  `tests-new/RegistryIsolation.test.ts` pass unchanged.
- Grep gate: count of `as unknown as` in `DbContext.ts` drops to ≤ 1 (the audited
  registry cast).

## Acceptance criteria

- [ ] `DbSetRegistry` owns `_dbSets` storage; public `set`/`defineSet` delegate.
- [ ] `as unknown as` casts in the DbSet factory paths reduced to a single
      documented site.
- [ ] `EntityCtor<T>` alias replaces `as unknown as Function`/`new () => object`.
- [ ] `test-d` inference cases pass; no public signature change.
- [ ] `pnpm typecheck && pnpm lint` pass.

## Refactor order

1. Add `EntityCtor<T>` alias + `DbSetRegistry`.
2. Migrate `set`/`defineSet`/`initializeDbSets` to it.
3. Add type-level tests + grep gate.

## Notes

Best done together with task-1 (which already extracts `DbSetRegistry`); this task
is the type-safety slice of that extraction and can be folded in.
