---
"@ts-linq/orm": minor
---

Add `IDbContextFactory<T>`, `DbContextPool<T>`, `PooledDbContextFactory<T>`, `DbContextFactory<T>`, and public factory functions `addDbContextPool` / `addDbContextFactory`.

Mirrors EF Core's `IDbContextFactory<T>` / `AddDbContextPool` / `AddDbContextFactory` APIs.

Key changes:
- `DbContextPool<T>`: LIFO pool that resets and recycles idle `DbContext` instances (default size: 128).
- `PooledDbContextFactory<T>`: leases contexts from the pool; `await using` automatically returns them via `Symbol.asyncDispose`.
- `DbContextFactory<T>`: simple (non-pooled) factory for explicit lifetime control.
- `addDbContextPool(Ctor, options, { poolSize })`: tree-shakable factory function for pooled contexts.
- `addDbContextFactory(Ctor, options)`: tree-shakable factory function for non-pooled contexts.
- `DbContext.reset()`: public method that clears ChangeTracker, L2 caches, and transaction depth.
- `DbContext[Symbol.asyncDispose]()`: enables `await using` on any context; pooled contexts are recycled, non-pooled are disposed.
- `DbContext.changeTracker`: promoted from `protected` to `public` (mirrors EF Core's public `ChangeTracker` property).
