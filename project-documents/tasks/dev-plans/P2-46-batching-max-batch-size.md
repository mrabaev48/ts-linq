---
title: SaveChanges Batching with MaxBatchSize
ef_core_api: optionsBuilder.UseSqlServer(conn, o => o.MaxBatchSize(50))
status: not-started
priority: P2
effort: M
depends_on: []
related: [P2-33-stored-procedure-mapping.md]
ts_linq_packages_touched: [@ts-linq/orm, @ts-linq/sql-visitor, @ts-linq/dialect-postgres, @ts-linq/dialect-mysql, @ts-linq/dialect-mssql]
---

# SaveChanges Batching with MaxBatchSize

## 1. Why (problem statement)

EF Core batches multiple `INSERT`/`UPDATE`/`DELETE` statements from a single `SaveChanges` call into one round-trip (per provider: SQL Server MERGE/multi-row INSERT; Postgres multi-row INSERT + RETURNING; MySQL multi-row INSERT). `MaxBatchSize` caps the batch to avoid parameter limit and statement-size issues. `ts-linq` currently emits one statement per affected row, which is the single biggest write-path performance gap. Closing it can yield 10–100× throughput improvement on bulk writes.

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
services.AddDbContext<AppContext>(o =>
    o.UseSqlServer(conn, sql => sql.MaxBatchSize(50)));

// Behavior: 200 inserts in one SaveChanges -> 4 round trips of 50 each
ctx.AddRange(orders);
await ctx.SaveChangesAsync();
```

TypeScript shape that `ts-linq` must mirror (signatures only, no implementation):

```ts
dbContextOptions.useMssql(conn, sql => sql.maxBatchSize(50));
dbContextOptions.usePostgres(conn, pg => pg.maxBatchSize(100));
dbContextOptions.useMysql(conn, my => my.maxBatchSize(50));

ctx.orders.addRange(orders);
await ctx.saveChangesAsync();
```

> Hard rule: the public TypeScript names, chaining order, and semantics MUST match EF Core. Internal implementation is free to deviate.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart LR
  A[SaveChanges entries] --> B[Group by table + op]
  B --> C{Op type}
  C -->|INSERT| D[Multi-row INSERT ... RETURNING]
  C -->|UPDATE| E[CTE-based bulk UPDATE FROM VALUES]
  C -->|DELETE| F[DELETE WHERE id IN (...)]
  D & E & F --> G[Split by MaxBatchSize]
  G --> H[Execute each chunk]
  H --> I[Read back generated values]
  I --> J[ChangeTracker accept]
```

- **Decision**: Group entries by `(table, operation)`, emit dialect-specific batch SQL, chunk by `MaxBatchSize` derived from parameter limit (PG: 65535, MSSQL: 2100, MySQL: depends on `max_allowed_packet`).
- **Context**: Each dialect has a different best-practice for batched DML; abstraction lives in the dialect with a common entry point.
- **Consequences**: (+) Massive throughput win. (-) Generated-PK readback adds complexity. (~) Stored-procedure-mapped entities (`P2-33`) cannot be batched.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/orm` (SaveChanges grouping + chunking), `@ts-linq/sql-visitor` (batch emitter), `@ts-linq/dialect-*` (per-dialect batch SQL + param limits).
- **New types / files**:
  - `packages/orm/src/save-changes/batch-grouper.ts`
  - `packages/orm/src/save-changes/batch-executor.ts`
  - `packages/sql-visitor/src/batch-emitter.ts`
  - `packages/dialect-postgres/src/batch-syntax.ts` — `INSERT ... VALUES (...),(...) RETURNING`
  - `packages/dialect-mssql/src/batch-syntax.ts` — `MERGE` or table-valued parameter
  - `packages/dialect-mysql/src/batch-syntax.ts` — `INSERT ... VALUES (...),(...)`
- **Touch-points**: existing `SaveChanges` dispatcher in `@ts-linq/orm`.
- **Data flow**: Entries → group by (table, op) → derive batch shape from dialect → split into chunks ≤ `MaxBatchSize` and ≤ paramLimit/perRow → execute → read back generated cols → accept changes.

## 5. Implementation options

### Option A — Per-dialect batch SQL with chunking in ORM
- Pros: Best perf per dialect.
- Cons: Three implementations to maintain.
- Effort: M

### Option B — Generic multi-statement transaction (`BEGIN; ...; COMMIT;`)
- Pros: Simple.
- Cons: Network round-trip per statement; no real win.

### Recommendation
Option A — the whole point of batching is to coalesce round-trips, which only multi-row DML achieves.

## 6. Related problems / follow-up tasks

- `[P2-33](./P2-33-stored-procedure-mapping.md)` — SP-mapped entities bypass batching; document.
- Concurrency token semantics on bulk UPDATE need explicit handling.

## 7. Acceptance criteria

- [ ] Public API exposes `maxBatchSize` on each dialect option builder
- [ ] Unit tests cover chunking at parameter-limit boundary
- [ ] Integration test against each dialect with mixed insert/update/delete
- [ ] Generated PKs returned to entities after batch insert
- [ ] Concurrency token violations detected and reported
- [ ] Docs in `apps/docs/` updated with throughput notes
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
