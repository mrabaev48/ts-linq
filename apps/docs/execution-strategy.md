# ExecutionStrategy and EnableRetryOnFailure

## Overview

`ts-linq` provides an `ExecutionStrategy` that automatically retries transient database failures
(deadlocks, connection drops, serialization failures) with exponential backoff — mirroring
EF Core's `IExecutionStrategy`.

## Quick Start

Configure retry behaviour when building your context options:

```ts
import { DbContextOptionsBuilder } from '@ts-linq/orm';

const opts = new DbContextOptionsBuilder({ provider })
  .enableRetryOnFailure({
    maxRetryCount: 5,       // retry up to 5 times
    maxRetryDelay: 30_000,  // cap backoff at 30 seconds
  })
  .build();

const ctx = new AppDbContext(opts);
```

Then wrap your work in a strategy:

```ts
const strategy = ctx.database.createExecutionStrategy();
await strategy.executeAsync(async () => {
  // All work here is retried as a unit on transient failure.
  await ctx.saveChanges();
});
```

## ⚠️ Idempotency Requirement

**The operation passed to `executeAsync` MUST be idempotent.**

If a transient error occurs, the entire block is re-executed from the beginning. Any
side effects from the previous attempt (inserts, external API calls, notifications) may
run again. You are responsible for making your block safe to repeat.

Patterns that are safe:

- Reading data and writing it back atomically using savepoints.
- Using database sequences or UUIDs for primary keys (re-inserting the same UUID is idempotent).
- Operations that first check existence (`INSERT ... WHERE NOT EXISTS`).

Patterns that are NOT safe without additional care:

- Sending emails or push notifications inside the block.
- Incrementing counters outside a transaction.
- Writing to external services without idempotency tokens.

## Transaction Savepoints

For fine-grained partial rollbacks within a transaction, use the savepoint API returned
by `beginTransactionAsync()`:

```ts
await using const tx = await ctx.database.beginTransactionAsync();
try {
  await ctx.saveChanges();                      // safe work
  await tx.createSavepointAsync('before_risky'); // mark checkpoint

  try {
    await doRisky();
  } catch {
    await tx.rollbackToSavepointAsync('before_risky'); // undo risky work only
  }

  await tx.releaseSavepointAsync('before_risky');
  await tx.commitAsync();
} catch {
  await tx.rollbackAsync();
}
```

`await using` ensures the transaction is automatically rolled back if the scope exits
without an explicit `commitAsync()` or `rollbackAsync()`.

## Provider Support

| Provider   | Savepoint SQL                                  | RELEASE support |
|------------|------------------------------------------------|-----------------|
| PostgreSQL | `SAVEPOINT / ROLLBACK TO SAVEPOINT / RELEASE`  | ✓               |
| MySQL      | `SAVEPOINT / ROLLBACK TO SAVEPOINT / RELEASE`  | ✓               |
| SQL Server | `SAVE TRANSACTION / ROLLBACK TRANSACTION`      | ✗ (no-op)       |

## Transient Error Classification

Each provider classifies errors using dialect-specific codes in addition to the base
heuristic (message contains "deadlock", "timeout", "connection"):

| Provider   | Codes / Numbers                                |
|------------|------------------------------------------------|
| PostgreSQL | 40001, 40P01, 08006, 08001, 08004, 57P01-03    |
| MySQL      | 1213, 1205, 2013, 2006, 1047                   |
| SQL Server | 1205, 1222, 49918-49920, 4060, 40197, 40501, … |

You can add extra codes via `errorCodesToAdd` in `ExecutionStrategyOptions`.
