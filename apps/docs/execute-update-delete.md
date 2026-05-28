# ExecuteUpdate and ExecuteDelete

`executeUpdate()` and `executeDelete()` translate a fluent LINQ query directly into a single SQL `UPDATE` or `DELETE` statement — without loading entities into the change tracker. They are the standard answer to bulk mutations like soft-deleting millions of rows or bumping a timestamp on all active users.

## EF Core parity

These methods mirror EF Core's `ExecuteUpdateAsync` / `ExecuteDeleteAsync` (EF7+), with the synchronous wrapper collapsed because ts-linq is always promise-based.

```typescript
// EF Core C# original:
// await ctx.Users.Where(u => u.LastLogin < cutoff)
//   .ExecuteUpdateAsync(s => s.SetProperty(u => u.IsLocked, true));
//
// ts-linq equivalent:
const n = await ctx.users
  .where(u => u.lastLogin < cutoff)
  .executeUpdate(s => s.setProperty(u => u.isLocked, true));
```

## executeDelete()

Deletes every row that matches the current WHERE predicate.

```typescript
// Delete all inactive logs older than the retention date
const deleted = await ctx.logs
  .where(l => l.createdAt < retentionDate)
  .executeDelete();

console.log(`Deleted ${deleted} rows.`);
```

**Without a WHERE clause**, all rows in the table are deleted — use with care.

```typescript
await ctx.auditLogs.executeDelete(); // DELETE FROM audit_logs — no filter!
```

## executeUpdate()

Updates every matching row with the specified SET assignments.

### Literal values

```typescript
await ctx.users
  .where(u => u.isActive)
  .executeUpdate(s =>
    s.setProperty(u => u.isLocked, true)
     .setProperty(u => u.lockedAt, new Date())
  );
// → UPDATE "users" SET "is_locked" = $1, "locked_at" = $2 WHERE "is_active" = $3
```

### JavaScript-computed values (pre-compute in JS, pass as literal)

When you need to derive a value from existing data fetched earlier, compute it in JavaScript and pass as a literal:

```typescript
const maxLevel = await ctx.users.max(u => u.level);
await ctx.users.executeUpdate(s =>
  s.setProperty(u => u.level, maxLevel + 1)
);
```

> SQL-level column-relative expressions like `count + 1` require transformer support and are deferred to a future release.

### Column-copy reference

Copy one column's value to another:

```typescript
await ctx.users.executeUpdate(s =>
  s.setProperty(u => u.name, u => u.displayName)
);
// → UPDATE "users" SET "name" = "display_name"
```

## API signature

```typescript
export interface ISetPropertyCalls<T> {
  setProperty<TProp>(
    propertySelector: (e: T) => TProp,
    valueOrSelector: TProp | ((e: T) => TProp),
  ): ISetPropertyCalls<T>;
}

// On Queryable<T> and DbSet<T>:
executeUpdate(setters: (s: ISetPropertyCalls<T>) => ISetPropertyCalls<T>): Promise<number>;
executeDelete(): Promise<number>;
```

Both methods return `Promise<number>` — the number of rows affected.

## Constraints and caveats

### include() is forbidden before bulk DML

`executeUpdate()` and `executeDelete()` do **not** support eager loading. Calling `include()` before either method throws:

```
Cannot call executeUpdate() after include(). Bulk DML does not support eager loading.
```

### ChangeTracker staleness

The change tracker is **not** notified about rows mutated by `executeUpdate` / `executeDelete`. If you have entity instances in memory that were affected, they will hold stale values. After a bulk update, reload any in-memory entities you still need:

```typescript
await ctx.users.where(u => u.id === userId).executeUpdate(s =>
  s.setProperty(u => u.name, 'New Name')
);
// ctx.users.local[userId].name is still the old value — reload if needed:
const fresh = await ctx.users.where(u => u.id === userId).firstOrDefault();
```

## Dialect SQL output

| Dialect | Generated SQL (example) |
|---------|------------------------|
| PostgreSQL | `UPDATE "users" SET "name" = $1, "is_locked" = $2 WHERE "active" = $3` |
| MySQL | `` UPDATE `users` SET `name` = ?, `is_locked` = ? WHERE `active` = ? `` |
| SQL Server | `UPDATE [users] SET [name] = @p1, [is_locked] = @p2 WHERE [active] = @p3` |

## Related

- [P0-03 FromSql](./P0-03-from-sql-interpolated.md) — provides the parameter-binding pipeline used by bulk DML.
- [P0-12 Interceptors](./P0-12-interceptors.md) — `IDbCommandInterceptor` observes `executeNonQuery` calls including bulk DML.
