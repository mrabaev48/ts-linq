# @ts-linq/e2e-tests

End-to-end tests for ts-linq ORM across all database providers (PostgreSQL, MySQL, MSSQL).

This is an **internal, non-published** package. It wires the full stack — `orm`, `query`,
`migrations`, the dialects, and the real providers — against live databases (typically via Docker)
to verify behavior end to end.

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
pnpm test

# Specific provider
pnpm test:postgres
pnpm test:mysql
pnpm test:mssql

# With Docker (all databases)
pnpm test:docker
pnpm test:docker-compose
```

> **Do not run these tests in the background** — they wait on live databases and will hang. Always
> run them in the foreground.

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

## Dependencies

Consumes the full runtime: `@ts-linq/orm`, `@ts-linq/query`, `@ts-linq/migrations`,
`@ts-linq/core`, `@ts-linq/metadata`, `@ts-linq/testkits`, the three dialects and the three
providers.
