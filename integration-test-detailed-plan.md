# Integration Tests - Detailed Plan (Days 3-7)

## Day 3: ORM + Cache Integration (1.5 days, 45 tests)
Status: Implemented — tests in `packages/integration-tests/tests-new/02-orm-cache/*.test.ts` ✅

### DbSet + SqlCache Integration (12 tests)

```typescript
// tests/02-orm-cache/dbset-sqlcache.test.ts
describe('DbSet + SqlCache Integration', () => {
  it('should cache SELECT query results', async () => {
    // Arrange: Execute users.where(u => u.age > 18).toArray()
    // Act: Execute same query again
    // Assert: Second query hits SqlCache, no DB round-trip
  })

  it('should use cache key based on SQL + parameters', async () => {
    // Arrange: Execute query with params [18]
    // Act: Execute query with params [20]
    // Assert: Different cache keys, both queries execute
  })

  it('should invalidate cache on INSERT', async () => {
    // Arrange: Cached SELECT * FROM users
    // Act: users.add(newUser); saveChanges()
    // Assert: Cache invalidated, next SELECT hits DB
  })

  it('should invalidate cache on UPDATE', async () => {
    // Arrange: Cached query result
    // Act: Update entity via ChangeTracker.saveChanges()
    // Assert: Cache invalidated for affected table
  })

  it('should invalidate cache on DELETE', async () => {
    // Arrange: Cached query
    // Act: users.remove(entity); saveChanges()
    // Assert: Cache invalidated
  })

  it('should respect TTL (time-to-live) expiration', async () => {
    // Arrange: Cache with 1s TTL, execute query
    // Act: Wait 1.5s, execute query again
    // Assert: Cache expired, DB query executed
  })

  it('should support manual cache warming', async () => {
    // Arrange: Pre-generate SQL and cache entries
    // Act: context.warmCache([commonQueries])
    // Assert: Subsequent queries hit cache immediately
  })

  it('should handle cache FIFO eviction when full', async () => {
    // Arrange: Cache with max size 10, add 11 entries
    // Act: Add 11th entry
    // Assert: First entry evicted
  })

  it('should cache count() results separately', async () => {
    // Arrange: Execute users.count()
    // Act: Execute users.count() again
    // Assert: Count cached, no DB query
  })

  it('should cache first() queries', async () => {
    // Arrange: Execute users.where(...).first()
    // Act: Execute same query again
    // Assert: Result cached
  })

  it('should NOT cache queries with skip/take (pagination)', async () => {
    // Arrange: users.skip(10).take(20)
    // Act: Execute twice
    // Assert: Cache bypassed for paginated queries (or cached separately)
  })

  it('should clear entire cache on demand', async () => {
    // Arrange: Multiple cached queries
    // Act: context.clearCache()
    // Assert: All cache entries removed
  })
})
```

### DbSet + CountCache Integration (8 tests)
Status: Implemented — `packages/integration-tests/tests-new/02-orm-cache/dbset-countcache.test.ts` ✅

```typescript
// tests/02-orm-cache/dbset-countcache.test.ts
describe('DbSet + CountCache Integration', () => {
  it('should cache count() with predicate', async () => {
    // Arrange: users.where(u => u.active === true).count()
    // Act: Execute same count() again
    // Assert: CountCache hit, no DB query
  })

  it('should use different cache keys for different predicates', async () => {
    // Arrange: count(u => u.age > 18), count(u => u.age > 21)
    // Act: Execute both
    // Assert: Separate cache entries
  })

  it('should invalidate count cache on entity insert', async () => {
    // Arrange: Cached count()
    // Act: Insert new entity
    // Assert: Count cache invalidated
  })

  it('should invalidate count cache on entity delete', async () => {
    // Arrange: Cached count()
    // Act: Delete entity
    // Assert: Count cache invalidated
  })

  it('should NOT invalidate count cache on entity UPDATE (count unchanged)', async () => {
    // Arrange: Cached count()
    // Act: Update entity (no new rows)
    // Assert: Count cache still valid
  })

  it('should support TTL expiration for count cache', async () => {
    // Arrange: CountCache with 2s TTL
    // Act: Wait 2.5s, count() again
    // Assert: Cache expired, fresh count
  })

  it('should evict LRU entries when count cache full', async () => {
    // Arrange: CountCache size=5, add 6 entries
    // Act: Add 6th entry
    // Assert: Least recently used entry evicted
  })

  it('should clear count cache independently', async () => {
    // Arrange: Both SqlCache and CountCache populated
    // Act: context.clearCountCache()
    // Assert: Only CountCache cleared, SqlCache intact
  })
})
```

### ChangeTracker + Redis Integration (12 tests)
Status: Implemented — `packages/integration-tests/tests-new/02-orm-cache/changetracker-redis.test.ts` ✅

```typescript
// tests/02-orm-cache/changetracker-redis.test.ts
describe('ChangeTracker + Redis Cache Integration', () => {
  it('should store entity in Redis L2 cache on load', async () => {
    // Arrange: users.find(1)
    // Act: Check Redis
    // Assert: Entity stored with key "users:1", serialized as JSON
  })

  it('should retrieve entity from Redis on subsequent loads', async () => {
    // Arrange: Load user#1, stored in Redis
    // Act: Load user#1 again
    // Assert: Retrieved from Redis, no DB query
  })

  it('should invalidate Redis entry on entity UPDATE', async () => {
    // Arrange: Entity cached in Redis
    // Act: Update entity, saveChanges()
    // Assert: Redis cache invalidated for that entity
  })

  it('should invalidate Redis entry on entity DELETE', async () => {
    // Arrange: Entity cached in Redis
    // Act: Delete entity, saveChanges()
    // Assert: Redis entry removed
  })

  it('should serialize complex entities (with nested objects)', async () => {
    // Arrange: Entity with nested address object
    // Act: Store in Redis, retrieve
    // Assert: Nested objects preserved correctly
  })

  it('should serialize Date fields correctly', async () => {
    // Arrange: Entity with createdAt: Date
    // Act: Store/retrieve from Redis
    // Assert: Date deserialized as Date object, not string
  })

  it('should handle Redis connection failure gracefully', async () => {
    // Arrange: Stop Redis server
    // Act: users.find(1)
    // Assert: Falls back to DB, no error thrown
  })

  it('should support TTL for entity cache in Redis', async () => {
    // Arrange: Configure Redis cache with 5s TTL
    // Act: Wait 6s, load entity
    // Assert: Expired, loaded from DB
  })

  it('should use namespace prefix for Redis keys', async () => {
    // Arrange: Configure cache with prefix "myapp:"
    // Act: Store entity
    // Assert: Redis key = "myapp:users:1"
  })

  it('should handle composite primary keys in Redis', async () => {
    // Arrange: Entity with composite key (tenantId, userId)
    // Act: Store in Redis
    // Assert: Key = "users:tenant1:user1"
  })

  it('should evict entries from Redis when max size reached', async () => {
    // Arrange: Redis cache with max 100 entries
    // Act: Store 101 entities
    // Assert: Oldest entry evicted (LRU)
  })

  it('should clear all entities from Redis cache', async () => {
    // Arrange: 50 entities cached in Redis
    // Act: context.clearRedisCache()
    // Assert: All Redis entries removed
  })
})
```

### ChangeTracker + Memcached Integration (8 tests)
Status: Implemented — `packages/integration-tests/tests-new/02-orm-cache/changetracker-memcached.test.ts` ✅

```typescript
// tests/02-orm-cache/changetracker-memcached.test.ts
describe('ChangeTracker + Memcached Integration', () => {
  it('should cache entities in Memcached', async () => {
    // Arrange: Load entity
    // Act: Check Memcached
    // Assert: Entity stored with serialized value
  })

  it('should retrieve entities from Memcached', async () => {
    // Arrange: Entity in Memcached
    // Act: Load entity
    // Assert: Retrieved from Memcached, no DB hit
  })

  it('should handle Memcached serialization errors gracefully', async () => {
    // Arrange: Entity with circular reference (un-serializable)
    // Act: Attempt to cache
    // Assert: Fallback to DB, error logged
  })

  it('should support TTL in Memcached', async () => {
    // Arrange: Cache with 3s TTL
    // Act: Wait 4s, load entity
    // Assert: Expired, loaded from DB
  })

  it('should handle Memcached server unavailable', async () => {
    // Arrange: Stop Memcached
    // Act: Load entity
    // Assert: Graceful fallback to DB
  })

  it('should use consistent hashing for Memcached keys', async () => {
    // Arrange: Multiple Memcached servers
    // Act: Store entities
    // Assert: Entities distributed across servers via hashing
  })

  it('should retry Memcached transient failures', async () => {
    // Arrange: Memcached with intermittent failures
    // Act: Load entity (retry policy)
    // Assert: Retried 3 times, eventually succeeds or falls back
  })

  it('should clear Memcached cache', async () => {
    // Arrange: Entities cached
    // Act: context.clearMemcachedCache()
    // Assert: All entries removed
  })
})
```

### Batch Operations + Cache Integration (5 tests)
Status: Implemented — `packages/integration-tests/tests-new/02-orm-cache/batch-operations-cache.test.ts` ✅

```typescript
// tests/02-orm-cache/batch-operations-cache.test.ts
describe('Batch Operations + Cache Integration', () => {
  it('should invalidate cache after bulk insert', async () => {
    // Arrange: Cached SELECT query
    // Act: BatchOperations.bulkInsert([100 entities])
    // Assert: Cache invalidated
  })

  it('should invalidate cache after bulk update', async () => {
    // Arrange: Cached query
    // Act: BatchOperations.bulkUpdate([entities])
    // Assert: Cache invalidated
  })

  it('should invalidate cache after bulk delete', async () => {
    // Arrange: Cached query
    // Act: BatchOperations.bulkDelete([ids])
    // Assert: Cache invalidated
  })

  it('should NOT cache batch operation results', async () => {
    // Arrange: Execute bulk insert
    // Act: Check cache
    // Assert: Bulk operations bypass cache
  })

  it('should clear cache across all adapters after batch', async () => {
    // Arrange: SqlCache, CountCache, Redis all populated
    // Act: Bulk insert
    // Assert: All caches invalidated
  })
})
```

---

## Day 4-5: Migrations + Dialect Integration (2 days, 60 tests)
Status: Implemented — tests in `packages/integration-tests/tests-new/03-migrations-dialect/*.test.ts` (SQLite/Postgres/MySQL/MSSQL DDL) ✅

### SQLite DDL Generation (15 tests)

```typescript
// tests/03-migrations-dialect/sqlite-ddl.test.ts
describe('SQLite Migrations + Dialect Integration', () => {
  describe('CREATE TABLE', () => {
    it('should generate CREATE TABLE with INTEGER PRIMARY KEY AUTOINCREMENT', async () => {
      // Arrange: Migration creating users table
      // Act: Generate DDL via SQLite dialect
      // Assert: SQL = "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, ...)"
    })

    it('should generate column with NOT NULL constraint', async () => {
      // Arrange: Column email NOT NULL
      // Act: Generate DDL
      // Assert: SQL contains "email TEXT NOT NULL"
    })

    it('should generate UNIQUE constraint', async () => {
      // Arrange: Column email UNIQUE
      // Act: Generate DDL
      // Assert: SQL = "email TEXT UNIQUE" or CONSTRAINT syntax
    })

    it('should generate DEFAULT value', async () => {
      // Arrange: Column active BOOLEAN DEFAULT 1
      // Act: Generate DDL
      // Assert: SQL = "active INTEGER DEFAULT 1"
    })

    it('should generate CHECK constraint', async () => {
      // Arrange: Column age with CHECK(age >= 18)
      // Act: Generate DDL
      // Assert: SQL = "CHECK (age >= 18)"
    })
  })

  describe('ALTER TABLE', () => {
    it('should generate ADD COLUMN', async () => {
      // Arrange: Add column phone to users
      // Act: Generate DDL
      // Assert: SQL = "ALTER TABLE users ADD COLUMN phone TEXT"
    })

    it('should handle ADD COLUMN with DEFAULT (workaround)', async () => {
      // Arrange: Add column with DEFAULT value
      // Act: Generate DDL
      // Assert: SQLite workaround (recreate table if needed)
    })

    it('should generate DROP COLUMN via table recreation', async () => {
      // Arrange: Drop column email
      // Act: Generate DDL
      // Assert: CREATE new table, copy data, drop old, rename
    })

    it('should NOT support ALTER COLUMN TYPE directly', async () => {
      // Arrange: Change column type VARCHAR -> TEXT
      // Act: Generate DDL
      // Assert: Table recreation strategy used
    })

    it('should support RENAME TABLE', async () => {
      // Arrange: Rename users -> customers
      // Act: Generate DDL
      // Assert: SQL = "ALTER TABLE users RENAME TO customers"
    })
  })

  describe('FOREIGN KEYS', () => {
    it('should generate FOREIGN KEY constraint', async () => {
      // Arrange: posts.userId references users.id
      // Act: Generate DDL
      // Assert: SQL = "FOREIGN KEY (userId) REFERENCES users(id)"
    })

    it('should enable PRAGMA foreign_keys for enforcement', async () => {
      // Arrange: Migration with FK
      // Act: Execute via SQLiteProvider
      // Assert: PRAGMA foreign_keys=ON executed first
    })

    it('should handle ON DELETE CASCADE', async () => {
      // Arrange: FK with ON DELETE CASCADE
      // Act: Generate DDL
      // Assert: SQL contains "ON DELETE CASCADE"
    })

    it('should handle ON UPDATE SET NULL', async () => {
      // Arrange: FK with ON UPDATE SET NULL
      // Act: Generate DDL
      // Assert: SQL contains "ON UPDATE SET NULL"
    })
  })

  describe('INDEXES', () => {
    it('should generate CREATE INDEX', async () => {
      // Arrange: Index on email column
      // Act: Generate DDL
      // Assert: SQL = "CREATE INDEX idx_users_email ON users(email)"
    })
  })
})
```

### PostgreSQL DDL Generation (15 tests) - Similar structure with Postgres-specific features

### MySQL DDL Generation (15 tests) - Similar structure with MySQL-specific features

### MSSQL DDL Generation (15 tests) - Similar structure with MSSQL-specific features

---

## Day 6: Telemetry + Resilience Integration (1.5 days, 40 tests)
Status: Implemented — tests in `packages/integration-tests/tests-new/04-telemetry-resilience/*.test.ts` (Prometheus/Otel/CircuitBreaker/Retry/Fallback) ✅

### Prometheus + Provider Integration (10 tests)
### OpenTelemetry + Provider Integration (8 tests)
### Circuit Breaker Integration (10 tests)
### Retry Policy Integration (7 tests)
### Fallback Strategy Integration (5 tests)

---

## Day 7: Advanced Features Integration (1.5 days, 35 tests)
Status: Implemented — tests in `packages/integration-tests/tests-new/05-metadata-decorators/*`, `06-pagination-query/*`, `07-advanced-features/*` ✅

### Metadata + Decorators (12 tests)
### Pagination + Query (8 tests)
### Soft Delete + Global Filters (8 tests)
### Multi-Tenant + Query (7 tests)

**TOTAL: ~245 integration tests across 7 days**