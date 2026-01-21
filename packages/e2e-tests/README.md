# @ts-linq/e2e-tests

End-to-end tests for ts-linq ORM across all database providers.

## Test Suites

### CRUD Operations (`tests/crud/`)
- Create, Read, Update, Delete operations
- Cross-provider testing (PostgreSQL, MySQL, MSSQL)
- Filtering, sorting, pagination

### Complex Queries (`tests/queries/`)
- JOIN operations (include)
- Nested includes
- Aggregations (count, sum, avg)
- GroupBy operations

### Transactions (`tests/transactions/`)
- Commit/rollback
- Nested transactions
- Atomic operations

## Running Tests

```bash
# All E2E tests
npm test

# Specific provider
npm run test:postgresql
npm run test:mysql
npm run test:mssql

# With Docker (all databases)
npm run test:docker
```

## Environment Variables

- `SKIP_DB_TESTS=1` - Skip database tests
- `POSTGRES_URL` - PostgreSQL connection string
- `MYSQL_URL` - MySQL connection string
- `MSSQL_URL` - MSSQL connection string

## Test Isolation

Each test uses `beforeEach/afterEach` for isolated execution:
- Fresh database context per test
- No state leakage between tests
- Parallel-safe execution
