# DbContext Pooling and IDbContextFactory

> **EF Core parity**: `IDbContextFactory<T>` · `AddDbContextFactory<T>` · `AddDbContextPool<T>`

---

## Why pooling?

Creating a `DbContext` on every request is cheap when RPS is low, but the cost accumulates:
- change-tracker initialisation allocates identity maps and tracking structures;
- the underlying provider connection may require a round-trip handshake.

`ts-linq` solves both problems with a **LIFO pool** that resets and recycles idle context
instances instead of discarding them.

---

## API overview

```ts
import {
  addDbContextFactory,
  addDbContextPool,
  IDbContextFactory
} from '@ts-linq/orm';
```

| Function              | Creates                    | Pool? | Use case                         |
|-----------------------|----------------------------|-------|----------------------------------|
| `addDbContextFactory` | `DbContextFactory<T>`      | No    | Infrequent / background jobs     |
| `addDbContextPool`    | `PooledDbContextFactory<T>`| Yes   | High-RPS servers, worker pools   |

Both implement `IDbContextFactory<T>`:

```ts
interface IDbContextFactory<T> {
  createDbContext(): T;
  createDbContextAsync(): Promise<T>;
}
```

---

## Simple factory (no pool)

```ts
import { addDbContextFactory } from '@ts-linq/orm';
import { PostgresProvider } from '@ts-linq/provider-postgres';

const provider = new PostgresProvider({ host: 'localhost', database: 'app' });
const factory = addDbContextFactory(AppContext, { provider });

// In a background job:
async function processJob(): Promise<void> {
  await using const ctx = await factory.createDbContextAsync();
  // ctx is a brand-new AppContext; disconnected automatically on scope exit
  const orders = await ctx.orders.where(o => !o.processed).toArray();
  // ...
}
```

Each call to `createDbContextAsync()` returns a fresh context instance.
`await using` triggers `Symbol.asyncDispose` which calls `dispose()` on exit.

---

## Pooled factory

```ts
import { addDbContextPool } from '@ts-linq/orm';

const factory = addDbContextPool(AppContext, { provider }, { poolSize: 32 });

async function handleRequest(): Promise<void> {
  await using const ctx = await factory.createDbContextAsync();
  ctx.orders.add(new Order({ description: 'Widget A' }));
  await ctx.saveChanges();
  // ctx is reset and returned to the pool — no disconnect
}
```

On `await using` exit, `Symbol.asyncDispose` is triggered. For pooled contexts this:
1. Resets the context (see below).
2. Pushes it back onto the pool stack.

The underlying database connection stays alive, eliminating reconnect latency for the
next checkout.

### Pool size

`poolSize` (default `128`) is the maximum number of **idle** instances retained.
When the pool is full and a context is returned, the excess context is fully disposed.

### Monitoring

```ts
console.log(`Idle contexts: ${factory.pool.size} / ${factory.pool.maxSize}`);
```

### Shutdown

```ts
await factory.dispose(); // closes all idle connections
```

---

## Reset semantics

When a context is returned to the pool, the following state is cleared:

| Cleared                      | Detail                                                    |
|------------------------------|-----------------------------------------------------------|
| `ChangeTracker`              | All tracked entity references and their snapshots removed |
| L2 entity / SQL / count cache| `CacheCoordinator.clearAll()`                             |
| Transaction depth counter    | Resets to `0`                                             |

The following is **intentionally preserved**:

| Preserved                    | Reason                                                    |
|------------------------------|-----------------------------------------------------------|
| Database connection          | Reconnect avoided; the provider stays connected           |
| Model metadata               | Entity type configs are immutable; re-building is wasteful|
| Interceptors & config        | Constructor-time options are invariant across uses        |

---

## `await using` support

`DbContext` implements `AsyncDisposable` via `Symbol.asyncDispose`:

```ts
// Non-pooled: equivalent to ctx.dispose()
await using const ctx = new AppContext({ provider });

// Pooled: returns to pool instead of disconnecting
await using const ctx = await factory.createDbContextAsync();
```

---

## Forbidden patterns

> Violations **will not throw** but produce silent data-corruption bugs.

### ❌ Storing entities in instance fields between checkouts

```ts
// BAD — entity reference survives the pool return
class AppContext extends DbContext {
  lastUser?: User; // will NOT be cleared by reset()
}
```

The pool only clears `ChangeTracker`. Any fields you add to your `DbContext`
subclass are **your responsibility** to reset, if needed, by overriding `reset()`.

### ❌ Starting a transaction and never committing / rolling back

```ts
// BAD
await ctx.beginTransaction();
// ... (forgot to commit) ...
await ctx[Symbol.asyncDispose](); // returns to pool WITH open transaction
```

Always commit or roll back before returning a context. The pool resets
`_transactionDepth` to `0` but does not rollback an in-flight transaction.

### ❌ Holding a pooled context across async boundaries you do not control

```ts
// BAD — ctx may be returned while the event handler still holds a reference
const ctx = await factory.createDbContextAsync();
setTimeout(() => ctx.users.toArray(), 5000); // ctx already in pool!
```

Keep pooled context lifetimes short and predictable.

---

## Overriding reset()

If your `DbContext` subclass holds mutable per-request state, override `reset()`:

```ts
class AppContext extends DbContext {
  currentUserId?: string; // request-scoped field

  override reset(): void {
    super.reset();           // always call super first
    this.currentUserId = undefined;
  }
}
```

---

## EF Core reference

| EF Core                                                        | ts-linq                                   |
|----------------------------------------------------------------|-------------------------------------------|
| `services.AddDbContextPool<T>(o => o.UseXxx(conn), 128)`      | `addDbContextPool(T, { provider }, { poolSize: 128 })` |
| `services.AddDbContextFactory<T>(o => o.UseXxx(conn))`        | `addDbContextFactory(T, { provider })`    |
| `IDbContextFactory<T>.CreateDbContextAsync()`                  | `IDbContextFactory<T>.createDbContextAsync()` |
| `await using var ctx = await factory.CreateDbContextAsync()`   | `await using const ctx = await factory.createDbContextAsync()` |
