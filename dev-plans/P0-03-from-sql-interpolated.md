---
title: FromSql, FromSqlRaw, FromSqlInterpolated and Database.SqlQuery
ef_core_api: DbSet<T>.FromSqlInterpolated($"SELECT * FROM users WHERE id = {id}") / DbSet<T>.FromSqlRaw / Database.SqlQuery<T> / Database.ExecuteSqlInterpolated
status: not-started
priority: P0
effort: L
depends_on: []
related: [P0-04, P0-12]
ts_linq_packages_touched: [@ts-linq/orm, @ts-linq/query, @ts-linq/sql-visitor, @ts-linq/provider-postgres, @ts-linq/provider-mysql, @ts-linq/provider-mssql]
---

# FromSql / FromSqlInterpolated / Database.SqlQuery

## 1. Why (problem statement)

There is always a query LINQ cannot express: vendor functions, hand-tuned CTEs, stored procedure results, full-text search. EF Core gives users `FromSqlInterpolated` (parameterised via C# interpolated strings) and `FromSqlRaw` that return an `IQueryable<T>` you can keep composing with `.Where`, `.Include`, `.OrderBy`. There is also `Database.SqlQuery<T>` (EF7+) for ad-hoc scalar/DTO shapes and `Database.ExecuteSqlInterpolated` for non-query commands. `ts-linq` currently only translates the LINQ AST; there is no escape hatch and no safe parameterisation API. Adding it unlocks migrations to ts-linq from raw-SQL codebases and is a prerequisite for `ExecuteUpdate/Delete` (P0-04).

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
var id = 42;
var blogs = ctx.Blogs
  .FromSqlInterpolated($"SELECT * FROM blogs WHERE owner_id = {id}")
  .Where(b => b.IsPublished)
  .Include(b => b.Posts)
  .ToList();

var names = ctx.Database
  .SqlQuery<string>($"SELECT name FROM users WHERE active = {true}")
  .ToList();

var affected = ctx.Database.ExecuteSqlInterpolated(
  $"UPDATE users SET locked = true WHERE last_login < {cutoff}");
```

TypeScript shape that `ts-linq` must mirror:

```ts
// tagged template helper provides EF's interpolation safety
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlInterpolated;

export class DbSet<T> {
  fromSqlInterpolated(query: SqlInterpolated): IQueryable<T>;
  fromSqlRaw(sql: string, ...params: unknown[]): IQueryable<T>;
}

export class DatabaseFacade {
  sqlQuery<T>(query: SqlInterpolated): IQueryable<T>;
  sqlQueryRaw<T>(sql: string, ...params: unknown[]): IQueryable<T>;
  executeSqlInterpolated(query: SqlInterpolated): Promise<number>;
  executeSqlRaw(sql: string, ...params: unknown[]): Promise<number>;
}
```

> Hard rule: public TypeScript names, chaining order, and semantics MUST match EF Core. The `sql` tag is the TS-idiomatic equivalent of C# interpolated strings — same safety guarantee.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart LR
  U[sql`SELECT ... ${id}`] --> Tag[sql tag builder]
  Tag --> SI[SqlInterpolated]
  SI --> Q[Queryable<T> seeded with RawSqlNode]
  Q --> SV[SqlVisitor wraps as subquery]
  SV --> Dlc[Dialect param binder]
  Dlc --> Prov[Provider.execute]
  Prov --> DB[(Database)]
```

- **Decision**: Introduce a `RawSqlNode` AST node that wraps user SQL plus a parameter list. The SQL visitor emits it as a derived table (`SELECT ... FROM (<user sql>) AS t0`) so LINQ composition keeps working.
- **Context**: `@ts-linq/ast` is already extensible. Dialects already own parameter formatting (`$1`, `?`, `@p0`).
- **Consequences**:
  - (+) Composition with `Where/Include/Order` falls out for free.
  - (+) Parameter safety is centralised in the `sql` tag — raw API is opt-in.
  - (−) User SQL must be wrappable; we forbid trailing semicolons and `;` injection.
  - (~) `Include` against a raw query requires shape introspection — document limits.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/ast`, `@ts-linq/query`, `@ts-linq/sql-visitor`, `@ts-linq/orm`, `@ts-linq/provider-*`
- **New types / files**:
  - `packages/orm/src/sql/sqlTag.ts` — `sql` tagged template + `SqlInterpolated` class.
  - `packages/ast/src/nodes/RawSqlNode.ts`
  - `packages/orm/src/DatabaseFacade.ts` — `ctx.database.sqlQuery / executeSql*`.
- **Touch-points**:
  - `packages/orm/src/DbSet.ts` — `fromSqlInterpolated`, `fromSqlRaw` seed a `Queryable<T>` with a `RawSqlNode` source.
  - `packages/query/src/Queryable.ts` — accept alternative source node in constructor.
  - `packages/sql-visitor/src/*.ts` — emit `FROM (<rawSql>) AS t<n>` and merge raw params into the param bag.
  - `packages/orm/src/DbContext.ts` — expose `database: DatabaseFacade`.
- **Data flow**: `sql` tag produces `SqlInterpolated { fragments: string[], values: unknown[] }`. `RawSqlNode` keeps both. Visitor walks fragments inserting dialect placeholders for each value, appends placeholders to the visitor's param list, and yields the wrapped derived table.

## 5. Implementation options

### Option A — Tagged template `sql` + RawSqlNode wrapped as derived table (recommended)
- Pros: composable with LINQ, parameter-safe, dialect-agnostic, mirrors EF semantics.
- Cons: deep `Include` against raw query has shape caveats.
- Effort: L

### Option B — Bypass AST, run SQL directly through provider, return plain array
- Pros: simplest.
- Cons: cannot compose with `.Where/.Include`; breaks EF parity.
- Effort: S

### Option C — Parse user SQL with a mini parser, lift columns into AST
- Pros: full composition fidelity.
- Cons: requires a SQL parser per dialect — enormous scope.
- Effort: XL

### Recommendation
Option A. Derived-table wrapping is exactly what EF Core does internally and is the smallest change for the largest behavior gain.

## 6. Related problems / follow-up tasks

- [P0-04](./P0-04-execute-update-delete.md) — depends on the parameter bag + `executeSql*` plumbing built here.
- [P0-12](./P0-12-interceptors.md) — `IDbCommandInterceptor` must see FromSql commands too.

## 7. Acceptance criteria

- [ ] Public API mirrors EF Core signature (`fromSqlInterpolated`, `fromSqlRaw`, `database.sqlQuery`, `database.executeSqlInterpolated`).
- [ ] `sql` tag refuses string concatenation of dynamic identifiers (security: parameters only).
- [ ] Unit tests cover composition: `fromSqlInterpolated(...).where(...).include(...).toList()`.
- [ ] Integration tests across postgres / mysql / mssql with correct placeholder syntax.
- [ ] Docs include side-by-side EF vs `ts-linq` examples and the SQL-injection guidance.
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`.

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
