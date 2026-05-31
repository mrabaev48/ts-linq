# Views and Keyless Entities (P1-26)

Map an entity to a database view and declare it keyless (read-only) — perfect for analytics shapes, report rows, and ad-hoc joins exposed as DB views.

## Quick Start

```ts
// 1. Define the shape (no PK required)
class SalesSummary {
  region!: string;
  totalSales!: number;
}

// 2. Configure via ModelBuilder
class AppDbContext extends DbContext {
  salesSummary = this.set<SalesSummary>(SalesSummary);

  protected onModelCreating(mb: ModelBuilder): void {
    mb.entity<SalesSummary>(SalesSummary, (b) => {
      b.hasNoKey();
      b.toView('v_sales_summary');
    });
  }
}

// 3. Query as usual — no tracking overhead
const rows = await ctx.salesSummary
  .where(s => s.region === 'EU')
  .toListAsync();
```

## API Reference

### `b.hasNoKey()`

Declares the entity as keyless. Keyless entities:
- are **never tracked** by `ChangeTracker`
- return plain objects (POJOs) from all queries
- throw `KeylessMutationError` on any `add`, `update`, `remove` call

### `b.toView(viewName: string)`

Sets the database view name used in `FROM` clauses instead of the default table name.

### `b.hasViewSql(sql: string)` _(optional)_

Supplies a `CREATE VIEW` DDL statement. If provided, migrations will emit this statement. If omitted, the view is assumed pre-existing (you manage DDL yourself).

```ts
mb.entity<SalesSummary>(SalesSummary, (b) => {
  b.hasNoKey();
  b.toView('v_sales_summary');
  b.hasViewSql(`
    CREATE VIEW v_sales_summary AS
    SELECT region, SUM(total) AS totalSales
    FROM orders
    GROUP BY region
  `);
});
```

## Mutation Guard

Any attempt to mutate a keyless entity throws `KeylessMutationError`:

```ts
ctx.salesSummary.add(row);        // throws KeylessMutationError
ctx.salesSummary.update(row);     // throws KeylessMutationError
ctx.salesSummary.remove(row);     // throws KeylessMutationError
ctx.salesSummary.addRange([row]); // throws KeylessMutationError
```

## Migration Support

When `hasViewSql()` is supplied, the schema snapshot includes a `ViewSnapshot` entry.
Migrations emit `CREATE VIEW` DDL only for views with explicit SQL.
Views without SQL are considered pre-existing — no DDL is generated.

## EF Core Equivalence

| EF Core (C#) | ts-linq (TypeScript) |
|---|---|
| `b.HasNoKey()` | `b.hasNoKey()` |
| `b.ToView("name")` | `b.toView("name")` |
| `HasData(sql)` via migrations | `b.hasViewSql(sql)` |
