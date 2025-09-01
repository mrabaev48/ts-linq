# Guide: Upsert and Batch Operations

This guide explains how to use provider-level upsert and batch operations.

## Upsert

Use provider `upsert(entity, EntityClass)` to insert or update by primary key.

```ts
const user = new User();
user.id = 1; // when PK provided, becomes update if exists
user.name = 'Alice';
await ctx.provider.upsert(user, User);
```

- PostgreSQL: uses `INSERT ... ON CONFLICT (...) DO UPDATE`
- MySQL: uses `INSERT ... ON DUPLICATE KEY UPDATE ...`
- MSSQL: uses `MERGE` with WHEN MATCHED/NOT MATCHED
- SQLite: default implementation falls back to update then insert

## Batch operations

- `insertMany(entities, EntityClass)` — transactional insert loop
- `updateMany(entities, EntityClass)` — transactional update loop
- `upsertMany(entities, EntityClass)` — transactional upsert loop

```ts
await ctx.provider.insertMany(users, User);
await ctx.provider.updateMany(users, User);
await ctx.provider.upsertMany(users, User);
```

## ChangeTracker vs Provider Batches

- Use `DbSet.addRange/updateRange/removeRange` to track many changes and call `saveChanges()` once
- Use provider batch methods when you want imperative bulk ops without tracking

## Optimistic Concurrency

If your entity has a version column (`@Column({ version: true })`), updates will enforce version match and increment.

