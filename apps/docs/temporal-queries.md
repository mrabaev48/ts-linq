# Temporal Queries (SQL Server System-Versioned Tables)

`ts-linq` supports EF Core's five temporal query operators for SQL Server system-versioned (temporal) tables. These operators mirror the EF Core API and emit `FOR SYSTEM_TIME` clauses in the generated SQL.

> **Dialect restriction**: Temporal queries are **MSSQL-only**. Using them with `PostgresDialect` or `MysqlDialect` throws a `TemporalNotSupportedError` at translation time, matching EF Core's own restriction.

---

## Setup

### 1. Configure SQL Server system-versioned table

The table must be created with `PERIOD FOR SYSTEM_TIME` and `SYSTEM_VERSIONING = ON` on the SQL Server side:

```sql
CREATE TABLE employees (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(255)     NOT NULL,
  department NVARCHAR(255)     NOT NULL,
  SysStart   DATETIME2         GENERATED ALWAYS AS ROW START NOT NULL,
  SysEnd     DATETIME2         GENERATED ALWAYS AS ROW END   NOT NULL,
  PERIOD FOR SYSTEM_TIME (SysStart, SysEnd)
)
WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.employeesHistory));
```

### 2. Mark the entity (fluent API)

```typescript
class AppDbContext extends DbContext {
  protected onModelCreating(mb: ModelBuilder): void {
    mb.entity(Employee)
      .isTemporal()
      .withHistoryTable('employeesHistory'); // optional; defaults to tableName + 'History'
  }
}
```

---

## Operators

### `temporalAsOf(pointInTime: Date)`

Returns the state of all rows at a specific point in time.
Emits `FOR SYSTEM_TIME AS OF @p`.

```typescript
const snapshot = await ctx.employees
  .temporalAsOf(new Date('2023-01-01'))
  .where(e => e.department === 'Sales')
  .toArray();
```

Generated SQL:
```sql
SELECT * FROM [employees] FOR SYSTEM_TIME AS OF @p1
WHERE department = @p2
```

---

### `temporalAll()`

Returns all rows — both current and historical.
Emits `FOR SYSTEM_TIME ALL`.

```typescript
const history = await ctx.employees
  .temporalAll()
  .orderBy('SysStart')
  .toArray();
```

Generated SQL:
```sql
SELECT * FROM [employees] FOR SYSTEM_TIME ALL
ORDER BY [SysStart] ASC
```

---

### `temporalBetween(from: Date, to: Date)`

Returns rows active at any point within the half-open interval `[from, to)`.
Emits `FOR SYSTEM_TIME BETWEEN @from AND @to`.

```typescript
const rows = await ctx.employees
  .temporalBetween(new Date('2022-01-01'), new Date('2023-01-01'))
  .toArray();
```

Generated SQL:
```sql
SELECT * FROM [employees] FOR SYSTEM_TIME BETWEEN @p1 AND @p2
```

---

### `temporalFromTo(from: Date, to: Date)`

Returns rows active at any point within the open interval `(from, to)`.
Emits `FOR SYSTEM_TIME FROM @from TO @to`.

```typescript
const rows = await ctx.employees
  .temporalFromTo(new Date('2022-01-01'), new Date('2023-01-01'))
  .toArray();
```

Generated SQL:
```sql
SELECT * FROM [employees] FOR SYSTEM_TIME FROM @p1 TO @p2
```

---

### `temporalContainedIn(from: Date, to: Date)`

Returns rows whose **entire active period** falls within `[from, to]`.
Emits `FOR SYSTEM_TIME CONTAINED IN (@from, @to)`.

```typescript
const rows = await ctx.employees
  .temporalContainedIn(new Date('2022-01-01'), new Date('2023-01-01'))
  .toArray();
```

Generated SQL:
```sql
SELECT * FROM [employees] FOR SYSTEM_TIME CONTAINED IN (@p1, @p2)
```

---

## Chaining with LINQ operators

Temporal operators return a `Queryable<T>` so you can chain any other LINQ operators:

```typescript
const result = await ctx.employees
  .temporalAsOf(new Date('2023-06-01'))
  .where(e => e.department === 'Engineering')
  .orderBy('name')
  .take(10)
  .toArray();
```

---

## Non-MSSQL dialects

Using any temporal operator on PostgreSQL or MySQL throws `TemporalNotSupportedError` at query-translation time (not at compile time), mirroring EF Core behaviour:

```typescript
// This throws TemporalNotSupportedError at runtime on PostgreSQL/MySQL:
await ctx.employees.temporalAll().toArray();
```

For row-history tracking on PostgreSQL or MySQL, use the `@ts-linq/plugin-audit` package instead.

---

## Semantic differences between operators

| Operator | Interval type | Semantics |
|---|---|---|
| `AsOf(t)` | Point | Single point-in-time snapshot |
| `All()` | All time | All historical + current rows |
| `Between(s, e)` | `[s, e)` | Rows active anywhere in half-open range |
| `FromTo(s, e)` | `(s, e)` | Rows active anywhere in open range |
| `ContainedIn(s, e)` | `[s, e]` | Rows whose entire period fits inside closed range |

These semantics match SQL Server `FOR SYSTEM_TIME` documentation and EF Core.
