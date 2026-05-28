---
title: ExecuteUpdate and ExecuteDelete — bulk updates without materialization
ef_core_api: IQueryable<T>.ExecuteUpdate(setters => setters.SetProperty(e => e.Prop, value)) / IQueryable<T>.ExecuteDelete() + async variants
status: done
priority: P0
effort: L
depends_on: [P0-03]
related: [P0-12]
ts_linq_packages_touched: [@ts-linq/query, @ts-linq/orm, @ts-linq/sql-visitor, @ts-linq/dialect-postgres, @ts-linq/dialect-mysql, @ts-linq/dialect-mssql]
---

# ExecuteUpdate and ExecuteDelete

## 1. Why (problem statement)

EF7 introduced `ExecuteUpdate` and `ExecuteDelete` — bulk DML translated directly to SQL UPDATE / DELETE without loading entities into the change tracker. They are the standard answer to "I have to soft-delete a million rows" or "I need to bump `lastSeenAt` on every active user". `ts-linq` today forces users to materialise entities, mutate them, then call `saveChanges`, which is O(N) round-trips for a job that should be a single `UPDATE`. With `FromSql` plumbing landing in P0-03 we now have the parameterised command pipeline needed to add bulk DML cleanly.

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
var n = await ctx.Users
  .Where(u => u.LastLogin < cutoff)
  .ExecuteUpdateAsync(setters => setters
    .SetProperty(u => u.IsLocked, true)
    .SetProperty(u => u.LockedAt, DateTime.UtcNow));

var deleted = await ctx.Logs
  .Where(l => l.Created < retention)
  .ExecuteDeleteAsync();
```

TypeScript shape that `ts-linq` must mirror:

```ts
export interface ISetPropertyCalls<T> {
  setProperty<TProp>(
    propertySelector: (e: T) => TProp,
    valueOrSelector: TProp | ((e: T) => TProp),
  ): ISetPropertyCalls<T>;
}

export interface IQueryable<T> {
  executeUpdate(setters: (s: ISetPropertyCalls<T>) => ISetPropertyCalls<T>): Promise<number>;
  executeDelete(): Promise<number>;
}
```

> Hard rule: the public TypeScript names and chaining order MUST match EF Core. We collapse sync / async because the TS LINQ port has always been promise-based.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart TB
  Q[Queryable<T>.where(...).executeUpdate(s => s.setProperty(...))] --> Coll[SetPropertyCalls collector]
  Coll --> Node[UpdateNode / DeleteNode AST root]
  Node --> SV[SqlVisitor UPDATE/DELETE branch]
  SV --> Dl[Dialect: UPDATE ... FROM / DELETE ... USING]
  Dl --> Prov[Provider.executeNonQuery]
  Prov --> RC[(rowsAffected)]
```

- **Decision**: Add two new AST roots (`UpdateNode`, `DeleteNode`) that wrap an existing predicate tree. SqlVisitor gets new entry methods that emit `UPDATE ... SET ... WHERE` / `DELETE FROM ... WHERE`, with dialect-specific JOIN syntax for queries that traverse navigations.
- **Context**: Dialects already vary heavily on multi-table UPDATE (postgres `UPDATE ... FROM`, mysql `UPDATE t JOIN ...`, mssql `UPDATE ... FROM ... INNER JOIN`). We add this branch in dialects, reuse the SELECT-side translation for predicates.
- **Consequences**:
  - (+) Single round-trip, no tracker pollution.
  - (+) Reuses param binding from P0-03.
  - (−) `Include` cannot apply to bulk DML; throw a clear error.
  - (~) ChangeTracker may hold stale snapshots for affected rows; document that and recommend `Reload`.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/ast`, `@ts-linq/query`, `@ts-linq/sql-visitor`, `@ts-linq/dialect-*`, `@ts-linq/orm`
- **New types / files**:
  - `packages/ast/src/nodes/UpdateNode.ts`
  - `packages/ast/src/nodes/DeleteNode.ts`
  - `packages/query/src/SetPropertyCalls.ts`
  - `packages/sql-visitor/src/visitors/UpdateVisitor.ts`
  - `packages/sql-visitor/src/visitors/DeleteVisitor.ts`
- **Touch-points**:
  - `packages/query/src/Queryable.ts` — add `executeUpdate`, `executeDelete`.
  - `packages/dialect-postgres/src/PostgresDialect.ts` — emit `UPDATE t SET ... FROM (...) src WHERE ...`.
  - `packages/dialect-mysql/src/MySqlDialect.ts` — emit `UPDATE t [JOIN ...] SET ... WHERE ...`.
  - `packages/dialect-mssql/src/MsSqlDialect.ts` — emit `UPDATE t SET ... FROM t INNER JOIN ...`.
  - `packages/orm/src/ChangeTracker.ts` — invalidate entries for entities whose key falls within the predicate (best-effort warning).
- **Data flow**: predicate translated as a normal SELECT predicate; collector turns property selectors into `(column, valueExpression)` pairs; visitor emits UPDATE/DELETE; provider returns rowsAffected.

## 5. Implementation options

### Option A — Per-dialect UPDATE/DELETE visitors (recommended)
- Pros: clean separation, leverages existing dialect class structure.
- Cons: three implementations to maintain.
- Effort: L

### Option B — Materialise keys then batch UPDATE/DELETE by primary key
- Pros: simple, dialect-agnostic.
- Cons: two round-trips, defeats the purpose, breaks `Where` semantics on JOINs.
- Effort: M

### Option C — Translate to CTE form (`WITH cte AS (SELECT id FROM ...) UPDATE t SET ... FROM cte`)
- Pros: uniform across dialects that support CTE with DML.
- Cons: mysql versions <8 lack support; performance penalty.
- Effort: L

### Recommendation
Option A. Each dialect's idiomatic form gives the best plan and matches what EF Core emits.

## 6. Related problems / follow-up tasks

- [P0-03](./P0-03-from-sql-interpolated.md) — provides the parameter and command-execution plumbing.
- [P0-12](./P0-12-interceptors.md) — `IDbCommandInterceptor` must observe these commands.

## 7. Acceptance criteria

- [ ] Public API mirrors EF Core signature.
- [ ] Calling `include(...)` before `executeUpdate/Delete` throws a descriptive error.
- [ ] Unit tests cover constant values, computed values (`e => e.count + 1`), and predicates with joins.
- [ ] Integration tests assert rowsAffected and correct rows mutated/deleted in postgres / mysql / mssql.
- [ ] Docs in `apps/docs/` updated with caveats around ChangeTracker staleness.
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`.

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
