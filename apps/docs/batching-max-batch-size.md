# Batching / MaxBatchSize

> **EF Core parity**: `optionsBuilder.UseSqlServer(conn, o => o.MaxBatchSize(50))`

## Overview

`ts-linq` groups `saveChanges()` operations into multi-row SQL statements when `maxBatchSize` is configured, reducing N database round-trips to `ceil(N / batchSize)` calls.

```ts
import { DbContextOptionsBuilder } from '@ts-linq/orm';

const options = new DbContextOptionsBuilder({ provider })
  .maxBatchSize(50)
  .build();

const ctx = new MyContext(options);
```

Without batching, inserting 200 entities costs 200 INSERT statements. With `maxBatchSize(50)`, the same operation costs 4 multi-row INSERT statements.

## How it works

When `maxBatchSize > 0`, `saveChanges()` routes through `BatchExecutor`:

1. **Group** — changes are grouped by `(entityClass, operation)` in declaration order.
2. **Chunk** — each group is split into chunks of at most `maxBatchSize` entities, further capped by the dialect's parameter limit.
3. **Emit** — each chunk becomes a single multi-row SQL statement via the dialect's `buildBatchInsert/Update/Delete` method.
4. **Writeback** — generated PKs (auto-increment) are written back to entity objects after INSERT.

## Dialect behaviour

| Dialect | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|
| PostgreSQL | `INSERT INTO "t" (...) VALUES ... RETURNING *` | CTE-based: `WITH _batch AS (VALUES ...) UPDATE ...` | `DELETE FROM "t" WHERE "pk" IN ($1,...)` |
| MSSQL | `INSERT INTO [t] (...) OUTPUT INSERTED.[pk] VALUES ...` | `UPDATE t SET ... FROM [t] t JOIN (VALUES ...) AS b ON ...` | `DELETE FROM [t] WHERE [pk] IN (@p1,...)` |
| MySQL | `INSERT INTO \`t\` (...) VALUES (?,?),...` + `LAST_INSERT_ID()` | Per-row `UPDATE` statements (MySQL limitation) | `DELETE FROM \`t\` WHERE \`pk\` IN (?,?,...)` |

## Parameter limits

Chunks are capped by both `maxBatchSize` and the dialect's parameter limit:

```ts
chunkSize = min(maxBatchSize, floor(paramLimit / paramsPerRow))
```

| Dialect | Parameter limit |
|---------|----------------|
| PostgreSQL | 65535 |
| MySQL | 65535 |
| MSSQL | 2100 |

## Generated PKs

After a batch INSERT, generated primary keys (auto-increment) are written back to entity objects in-place:

```ts
const orders = [new Order(), new Order(), new Order()];
for (const o of orders) ctx.orders.add(o);
await ctx.saveChanges();

// PKs are now available on the entity objects
console.log(orders[0].id); // 1
console.log(orders[1].id); // 2
console.log(orders[2].id); // 3
```

## Performance notes

- Batch INSERT throughput scales near-linearly with batch size for network-bound workloads.
- MSSQL UPDATE uses a VALUES-JOIN pattern that is efficient for up to a few thousand rows.
- MySQL UPDATE is per-row inside a single transaction (no clean multi-row UPDATE syntax); each statement is sent over the same connection, so round-trip overhead is minimal.
- Very wide rows (many columns) may reduce effective chunk size due to parameter limits.

## Without batching (default)

When `maxBatchSize` is not set (or 0), `saveChanges()` uses the existing per-row path unchanged — no regression for existing code.
