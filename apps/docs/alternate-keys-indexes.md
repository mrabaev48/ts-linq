# Alternate Keys and Rich Indexes

> P1-31 — Mirrors EF Core's `HasAlternateKey` / `HasIndex(...).IsUnique().HasFilter(...).IncludeProperties(...).IsDescending(...)`

---

## Alternate Keys

An **alternate key** is a named `UNIQUE` constraint on one or more non-PK columns. It can serve as the target of a foreign key, letting you enforce uniqueness on business keys without exposing the surrogate PK.

```ts
// Single-column
modelBuilder.entity(User, (b) => {
  b.hasAlternateKey(u => u.email);
});

// Multi-column
modelBuilder.entity(Order, (b) => {
  b.hasAlternateKey(o => [o.tenantId, o.publicNumber]);
});
```

Alternate keys are emitted as named `UNIQUE` constraints — not as plain indexes — so they are structurally different from `hasIndex(...).isUnique()`.

### FK → Alternate Key

Use `hasPrincipalKey` on the relationship builder to target an alternate key:

```ts
modelBuilder.entity(Invoice, (b) => {
  b.hasOne(i => i.user, User)
    .withMany(u => u.invoices)
    .hasForeignKey(i => i.userEmail)
    .hasPrincipalKey(u => u.email);
});
```

---

## Rich Indexes

### `hasIndex` — lambda selector form

```ts
modelBuilder.entity(Post, (b) => {
  b.hasIndex(p => [p.authorId, p.publishedAt])
    .isUnique()
    .hasFilter("deleted_at IS NULL")
    .includeProperties(p => [p.title, p.slug])
    .isDescending([false, true]);
});
```

| Method | Description |
|--------|-------------|
| `isUnique()` | Adds `UNIQUE` to the index |
| `hasFilter(sql)` | Partial index — `WHERE` clause |
| `includeProperties(sel)` | Covering index — non-key columns |
| `isDescending(flags[])` | Per-column sort direction (true = DESC) |
| `hasName(name)` | Override auto-generated index name |

---

## Dialect support matrix

| Feature | PostgreSQL | MySQL | SQL Server |
|---------|-----------|-------|------------|
| Alternate keys (`UNIQUE` constraint) | ✓ | ✓ | ✓ |
| FK → Alternate key | ✓ | ✓ | ✓ |
| Filtered index (`WHERE`) | ✓ | ✗ warning | ✓ |
| Covering index (`INCLUDE`) | ✓ | ✗ | ✓ |
| Descending columns | ✓ | ✓ | ✓ |

> **MySQL note**: `hasFilter()` is silently dropped and a warning is emitted, because MySQL does not support partial indexes. The index is still created without the filter.

> **PostgreSQL note**: `includeProperties()` generates `INCLUDE (...)` syntax, supported from PostgreSQL 11+.

---

## Migration DDL

### PostgreSQL
```sql
-- Alternate key
ALTER TABLE "users" ADD CONSTRAINT "AK_User_email" UNIQUE ("email");

-- Covering filtered unique index
CREATE UNIQUE INDEX "IX_Post_authorId_publishedAt"
  ON "posts" ("authorId" ASC, "publishedAt" DESC)
  INCLUDE ("title", "slug")
  WHERE deleted_at IS NULL;
```

### MySQL
```sql
-- Alternate key
ALTER TABLE `users` ADD UNIQUE KEY `AK_User_email` (`email`);

-- Index (no filter support)
CREATE UNIQUE INDEX `IX_Post_authorId_publishedAt`
  ON `posts` (`authorId` ASC, `publishedAt` DESC);
```

### SQL Server
```sql
-- Alternate key
ALTER TABLE [users] ADD CONSTRAINT [AK_User_email] UNIQUE ([email]);

-- Covering filtered unique index
CREATE UNIQUE INDEX [IX_Post_authorId_publishedAt]
  ON [posts] ([authorId] ASC, [publishedAt] DESC)
  INCLUDE ([title], [slug])
  WHERE deleted_at IS NULL;
```
