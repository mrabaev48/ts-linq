# EF.Functions

`EF.functions` provides access to database-specific functions within LINQ expressions without leaking raw SQL into user code.

## Usage

```ts
const rows = await context.posts
  .where(p => EF.functions.like(p.title, '%urgent%'))
  .toList();

const recent = await context.logs
  .where(l => EF.functions.dateDiffDay(l.createdAt, new Date()) <= 7)
  .toList();

const sorted = await context.items
  .orderBy(_ => EF.functions.random())
  .take(10)
  .toList();
```

## Function Support Matrix

| Function          | PostgreSQL                                | MySQL                        | SQL Server                    |
|-------------------|-------------------------------------------|------------------------------|-------------------------------|
| `like`            | `col LIKE ?`                              | `col LIKE ?`                 | `col LIKE ?`                  |
| `iLike`           | `col ILIKE ?`                             | ❌ not supported              | ❌ not supported               |
| `random`          | `RANDOM()`                                | `RAND()`                     | `ABS(CHECKSUM(NEWID()))`      |
| `dateDiffDay`     | `(col::date - ?::date)`                   | `DATEDIFF(col, ?)`           | `DATEDIFF(DAY, ?, col)`       |
| `dateDiffMonth`   | `EXTRACT(... AGE(col, ?))`                | `TIMESTAMPDIFF(MONTH, ?, col)` | `DATEDIFF(MONTH, ?, col)`  |
| `greatest`        | `GREATEST(...)`                           | `GREATEST(...)`              | `SELECT MAX(v) FROM (VALUES ...)` |
| `least`           | `LEAST(...)`                              | `LEAST(...)`                 | `SELECT MIN(v) FROM (VALUES ...)` |
| `stDev`           | `STDDEV(col)`                             | `STDDEV(col)`                | `STDEV(col)`                  |
| `variance`        | `VARIANCE(col)`                           | `VARIANCE(col)`              | `VAR(col)`                    |

## Setting Up per Dialect

Pass the dialect's `EfFunctionTranslator` via `SqlVisitor` options:

```ts
import { postgresEfFunctions } from '@ts-linq/dialect-postgres';
import { SqlVisitor } from '@ts-linq/sql-visitor';

const visitor = new SqlVisitor(ParameterStyle.Positional, {
  efFunctionTranslator: postgresEfFunctions,
});
```

## User-Defined Functions (`hasDbFunction`)

Register custom SQL functions for use in LINQ expressions:

```ts
class MyContext extends DbContext {
  // Marker method — called only in LINQ expressions
  jsonExtract(data: unknown, key: string): string {
    return EF.functions.like(data, key) as unknown as string; // marker
  }

  protected onModelCreating(mb: ModelBuilder): void {
    mb.hasDbFunction(MyContext.prototype.jsonExtract)
      .hasName('jsonb_extract_path_text');
  }
}
```

## Error Handling

Calling `EF.functions` methods outside a compiled LINQ expression throws immediately:

```ts
// ❌ Throws: "EF.functions.like() can only be used inside a compiled LINQ expression"
EF.functions.like('col', '%pattern%');

// ✅ Only valid inside .where(), .orderBy(), etc.
context.posts.where(p => EF.functions.like(p.title, '%pattern%'));
```

Using `iLike` on a non-PostgreSQL dialect throws `AstSqlGenerationError` at query time:

```ts
// ❌ Throws: "EF.functions.iLike() is only supported on PostgreSQL"
context.posts.where(p => EF.functions.iLike(p.title, '%pattern%'));
// when using mysqlEfFunctions or mssqlEfFunctions
```
