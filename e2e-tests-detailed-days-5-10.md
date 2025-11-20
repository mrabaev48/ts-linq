# E2E Tests: Days 5-10 Detailed Plan

## Day 5: LINQ Queries (1 day, 40 tests)

```typescript
// tests/04-linq-queries/complex-where.test.ts
describe('Complex WHERE Clauses E2E', () => {
  it('should handle nested AND/OR predicates', async () => {
    // Arrange: Insert 100 users with various attributes
    // Act: users.where(u => (u.age > 18 && u.active === true) || u.role === 'admin')
    // Assert: Returns correct subset
  })

  it('should handle LIKE/contains operator', async () => {
    // Arrange: Insert users with emails
    // Act: users.where(u => u.email.includes('@gmail.com'))
    // Assert: Returns only Gmail users
  })

  it('should handle startsWith operator', async () => {
    // Arrange: Insert users
    // Act: users.where(u => u.name.startsWith('John'))
    // Assert: Returns users whose name starts with 'John'
  })

  it('should handle endsWith operator', async () => {
    // Arrange: Insert files
    // Act: files.where(f => f.name.endsWith('.pdf'))
    // Assert: Returns only PDF files
  })

  it('should handle IN operator with array', async () => {
    // Arrange: Insert users
    // Act: users.where(u => [1, 2, 3].includes(u.id))
    // Assert: Returns users with IDs 1, 2, 3
  })

  it('should handle NOT IN operator', async () => {
    // Arrange: Insert users
    // Act: users.where(u => ![1, 2, 3].includes(u.id))
    // Assert: Returns users with IDs not in [1, 2, 3]
  })

  it('should handle BETWEEN operator', async () => {
    // Arrange: Insert orders with amounts
    // Act: orders.where(o => o.amount >= 100 && o.amount <= 500)
    // Assert: Returns orders in range [100, 500]
  })

  it('should handle IS NULL / IS NOT NULL', async () => {
    // Arrange: Insert users (some with null emails)
    // Act: users.where(u => u.email === null)
    // Assert: Returns users without email
  })

  it('should handle negation (!)', async () => {
    // Arrange: Insert users
    // Act: users.where(u => !(u.age > 18))
    // Assert: Returns users under 18
  })

  it('should handle complex mathematical expressions', async () => {
    // Arrange: Insert products with price/quantity
    // Act: products.where(p => p.price * p.quantity > 1000)
    // Assert: Returns expensive products
  })
})

// tests/04-linq-queries/joins.test.ts
describe('JOIN Operations E2E', () => {
  it('should execute INNER JOIN across 2 tables', async () => {
    // Arrange: Users and orders tables
    // Act: users.join(orders, 'id', 'userId').toArray()
    // Assert: Returns users with orders (cartesian product)
  })

  it('should execute LEFT JOIN preserving null right side', async () => {
    // Arrange: Some users without orders
    // Act: users.leftJoin(orders, 'id', 'userId').toArray()
    // Assert: All users returned, orders null for some
  })

  it('should execute RIGHT JOIN preserving null left side', async () => {
    // Arrange: Orders for deleted users (orphan records)
    // Act: users.rightJoin(orders, 'id', 'userId').toArray()
    // Assert: All orders returned, user null for orphans
  })

  it('should execute multi-table JOIN (3 tables)', async () => {
    // Arrange: Users, orders, products
    // Act: users.join(orders).join(products)
    // Assert: Returns combined data from 3 tables
  })

  it('should filter JOIN results with WHERE', async () => {
    // Arrange: Users with orders
    // Act: users.join(orders).where(o => o.amount > 100)
    // Assert: Returns only orders > 100
  })

  it('should apply GROUP BY after JOIN', async () => {
    // Arrange: Users with multiple orders
    // Act: users.join(orders).groupBy('userId').select({ userId, totalAmount: sum('amount') })
    // Assert: Returns total amount per user
  })

  it('should handle self-join (employees → managers)', async () => {
    // Arrange: Employees table with managerId FK
    // Act: employees.join(employees, 'managerId', 'id')
    // Assert: Returns employees with their managers
  })
})

// tests/04-linq-queries/aggregations.test.ts (10 tests)
describe('Aggregation Queries E2E', () => {
  it('should execute sum()', async () => {
    // Arrange: Insert orders with amounts
    // Act: orders.sum(o => o.amount)
    // Assert: Returns correct sum
  })

  it('should execute avg()', async () => {
    // Arrange: Insert products with prices
    // Act: products.average(p => p.price)
    // Assert: Returns average price
  })

  it('should execute min()', async () => {
    // Arrange: Insert entities
    // Act: products.min(p => p.price)
    // Assert: Returns lowest price
  })

  it('should execute max()', async () => {
    // Arrange: Insert entities
    // Act: products.max(p => p.price)
    // Assert: Returns highest price
  })

  it('should execute count() with DISTINCT', async () => {
    // Arrange: Orders with duplicate userIds
    // Act: orders.select(o => o.userId).distinct().count()
    // Assert: Returns unique user count
  })

  it('should execute GROUP BY with multiple aggregates', async () => {
    // Arrange: Sales data
    // Act: sales.groupBy('region').select({ region, total: sum('amount'), avg: avg('amount'), count: count() })
    // Assert: Returns aggregated stats per region
  })

  it('should execute HAVING after GROUP BY', async () => {
    // Arrange: Sales data grouped by region
    // Act: sales.groupBy('region').having(g => sum('amount') > 10000)
    // Assert: Returns only regions with total > 10000
  })

  it('should handle COUNT(*) vs COUNT(column)', async () => {
    // Arrange: Entities with nullable field
    // Act: entities.count() vs entities.count(e => e.optionalField)
    // Assert: Different counts (COUNT(*) includes nulls)
  })

  it('should execute aggregates with WHERE filter', async () => {
    // Arrange: Orders (some cancelled)
    // Act: orders.where(o => o.status === 'completed').sum(o => o.amount)
    // Assert: Sum of completed orders only
  })

  it('should execute window functions (RANK, ROW_NUMBER)', async () => {
    // Arrange: Products with categories
    // Act: products.select({ name, price, rank: rank().over().partitionBy('category').orderBy('price DESC') })
    // Assert: Products ranked by price within category
  })
})

// tests/04-linq-queries/subqueries.test.ts (8 tests)
describe('Subquery Operations E2E', () => {
  it('should execute IN with subquery', async () => {
    // Arrange: Users with orders
    // Act: users.where(u => u.id.in(orders.select(o => o.userId)))
    // Assert: Returns users who have orders
  })

  it('should execute EXISTS with subquery', async () => {
    // Arrange: Users with/without posts
    // Act: users.where(u => exists(posts.where(p => p.userId === u.id)))
    // Assert: Returns users with posts
  })

  it('should execute NOT EXISTS with subquery', async () => {
    // Arrange: Users with/without orders
    // Act: users.where(u => notExists(orders.where(o => o.userId === u.id)))
    // Assert: Returns users without orders
  })

  it('should execute scalar subquery in SELECT', async () => {
    // Arrange: Users with order counts
    // Act: users.select({ name, orderCount: orders.where(o => o.userId === u.id).count() })
    // Assert: Returns users with their order counts
  })

  it('should execute correlated subquery', async () => {
    // Arrange: Products with average price per category
    // Act: products.where(p => p.price > products.where(p2 => p2.category === p.category).average('price'))
    // Assert: Returns products above category average
  })

  it('should execute subquery with aggregation', async () => {
    // Arrange: Orders
    // Act: orders.where(o => o.amount > orders.average('amount'))
    // Assert: Returns above-average orders
  })

  it('should handle nested subqueries', async () => {
    // Arrange: Multi-level data
    // Act: Query with 2-3 levels of subqueries
    // Assert: Correct deeply nested results
  })

  it('should execute subquery in HAVING clause', async () => {
    // Arrange: Sales by region
    // Act: sales.groupBy('region').having(g => sum('amount') > sales.average('amount'))
    // Assert: Returns high-performing regions
  })
})
```

---

## Day 6: Transactions (1 day, 30 tests)

```typescript
// tests/05-transactions/commit-rollback.test.ts
describe('Transaction Commit/Rollback E2E', () => {
  it('should commit transaction successfully', async () => {
    // Arrange: Begin transaction
    // Act: Insert 3 entities, commit
    // Assert: All 3 persisted in database
  })

  it('should rollback transaction on error', async () => {
    // Arrange: Begin transaction
    // Act: Insert valid entity + invalid entity, error thrown
    // Assert: Rollback executed, no data persisted
  })

  it('should rollback on manual rollback() call', async () => {
    // Arrange: Begin transaction, insert entities
    // Act: Call transaction.rollback()
    // Assert: Changes discarded
  })

  it('should auto-rollback on uncaught exception', async () => {
    // Arrange: Begin transaction
    // Act: Insert entity, throw error
    // Assert: Transaction auto-rolled back
  })

  it('should handle multiple sequential transactions', async () => {
    // Arrange: Empty database
    // Act: TX1 commit, TX2 commit, TX3 rollback
    // Assert: TX1 and TX2 data persisted, TX3 not
  })

  it('should isolate transactions (Read Committed)', async () => {
    // Arrange: Begin TX1, insert entity (uncommitted)
    // Act: Begin TX2, query same table
    // Assert: TX2 does not see uncommitted entity
  })

  it('should handle transaction timeout', async () => {
    // Arrange: Begin transaction with 1s timeout
    // Act: Sleep 2s, attempt commit
    // Assert: Throws timeout error
  })

  it('should support explicit transaction with using block', async () => {
    // Arrange: using (transaction = context.beginTransaction())
    // Act: Insert entities within using block
    // Assert: Auto-commits on block exit
  })

  it('should release locks on commit', async () => {
    // Arrange: Begin TX, acquire lock
    // Act: Commit
    // Assert: Other transactions can acquire lock
  })

  it('should release locks on rollback', async () => {
    // Arrange: Begin TX, acquire lock
    // Act: Rollback
    // Assert: Other transactions can acquire lock
  })
})

// tests/05-transactions/savepoints.test.ts
describe('Savepoints (Nested Transactions) E2E', () => {
  it('should create savepoint within transaction', async () => {
    // Arrange: Begin transaction
    // Act: Insert entity1, create savepoint, insert entity2
    // Assert: Both entities tracked
  })

  it('should rollback to savepoint', async () => {
    // Arrange: TX with savepoint after entity1
    // Act: Insert entity2, rollback to savepoint
    // Assert: entity1 persisted, entity2 discarded
  })

  it('should support multiple nested savepoints', async () => {
    // Arrange: TX with SP1, SP2, SP3
    // Act: Rollback to SP2
    // Assert: Changes after SP2 discarded, before SP2 intact
  })

  it('should commit outer transaction with savepoints', async () => {
    // Arrange: TX with savepoints
    // Act: Commit transaction
    // Assert: All non-rolled-back changes persisted
  })

  it('should rollback outer transaction (discards savepoints)', async () => {
    // Arrange: TX with savepoints
    // Act: Rollback outer TX
    // Assert: All changes discarded, savepoints irrelevant
  })

  it('should handle savepoint name collision', async () => {
    // Arrange: Create SP named 'sp1'
    // Act: Create another SP named 'sp1'
    // Assert: Error or overwrites (dialect-specific)
  })

  it('should support savepoint with explicit name', async () => {
    // Arrange: TX
    // Act: createSavepoint('beforeInsert')
    // Assert: Can rollback to 'beforeInsert'
  })
})

// tests/05-transactions/isolation-levels.test.ts (10 tests)
describe('Transaction Isolation Levels E2E', () => {
  it('should enforce READ UNCOMMITTED (dirty reads allowed)', async () => {
    // Arrange: Set isolation READ UNCOMMITTED
    // Act: TX1 inserts uncommitted row, TX2 reads
    // Assert: TX2 sees uncommitted data
  })

  it('should enforce READ COMMITTED (no dirty reads)', async () => {
    // Arrange: Set isolation READ COMMITTED
    // Act: TX1 inserts uncommitted row, TX2 reads
    // Assert: TX2 does NOT see uncommitted data
  })

  it('should enforce REPEATABLE READ (no phantom reads)', async () => {
    // Arrange: Set isolation REPEATABLE READ
    // Act: TX1 reads rows, TX2 inserts matching row, TX1 reads again
    // Assert: TX1 sees same rows both times
  })

  it('should enforce SERIALIZABLE (full isolation)', async () => {
    // Arrange: Set isolation SERIALIZABLE
    // Act: Concurrent transactions
    // Assert: Transactions serialize, no concurrency anomalies
  })

  it('should handle different isolation levels per transaction', async () => {
    // Arrange: TX1 with READ COMMITTED, TX2 with SERIALIZABLE
    // Act: Run concurrently
    // Assert: Each respects its isolation level
  })

  it('should default to database default isolation', async () => {
    // Arrange: No explicit isolation set
    // Act: Begin transaction
    // Assert: Uses provider default (e.g., READ COMMITTED for Postgres)
  })

  it('should support SNAPSHOT isolation (MSSQL)', async () => {
    // Arrange: MSSQL with SNAPSHOT isolation
    // Act: Concurrent updates
    // Assert: Snapshot isolation behavior observed
  })

  it('should detect write conflicts in SERIALIZABLE', async () => {
    // Arrange: Two serializable transactions
    // Act: Both try to update same row
    // Assert: Second throws conflict error
  })

  it('should handle isolation level upgrade within TX', async () => {
    // Arrange: Begin TX with READ COMMITTED
    // Act: Change to SERIALIZABLE mid-transaction
    // Assert: New isolation applies
  })

  it('should reset isolation after transaction ends', async () => {
    // Arrange: TX with SERIALIZABLE
    // Act: Commit
    // Assert: Next TX uses default isolation
  })
})

// tests/05-transactions/deadlocks.test.ts (8 tests)
describe('Deadlock Detection E2E', () => {
  it('should detect deadlock between 2 transactions', async () => {
    // Arrange: TX1 locks row1, TX2 locks row2
    // Act: TX1 tries row2, TX2 tries row1
    // Assert: Database detects deadlock, one TX aborted
  })

  it('should throw DeadlockError with details', async () => {
    // Arrange: Deadlock scenario
    // Act: Trigger deadlock
    // Assert: Exception contains deadlock info
  })

  it('should allow retry after deadlock', async () => {
    // Arrange: Deadlock occurs
    // Act: Catch DeadlockError, retry transaction
    // Assert: Retry succeeds
  })

  it('should handle circular deadlock (3+ transactions)', async () => {
    // Arrange: TX1, TX2, TX3 in circular wait
    // Act: Execute
    // Assert: Deadlock detected and resolved
  })

  it('should timeout on unresolved deadlock', async () => {
    // Arrange: Deadlock that cannot be resolved
    // Act: Wait for timeout
    // Assert: Throws timeout error
  })

  it('should log deadlock events', async () => {
    // Arrange: Logger configured
    // Act: Trigger deadlock
    // Assert: Deadlock logged
  })

  it('should apply deadlock retry policy', async () => {
    // Arrange: Configure retry policy for deadlocks
    // Act: Trigger deadlock
    // Assert: Retries attempted automatically
  })

  it('should avoid deadlock with lock ordering', async () => {
    // Arrange: TX1 and TX2 lock rows in same order
    // Act: Execute concurrently
    // Assert: No deadlock occurs
  })
})
```

---

## Day 7: Migrations (1 day, 35 tests)

## Day 8: Caching (1 day, 40 tests)

## Day 9: Performance & Concurrency (1 day, 45 tests)

## Day 10: Multi-Provider Testing (1 day, 30 tests)

**Total E2E Tests: ~313 tests across 10 days**