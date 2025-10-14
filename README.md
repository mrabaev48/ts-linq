# ORM Framework

## Overview

This is a TypeScript ORM (Object-Relational Mapping) framework heavily inspired by Entity Framework Core. It provides a code-first approach to database management with decorator-based entity definitions, change tracking, LINQ-style querying, and a migration system. The framework follows Entity Framework's architectural patterns with a layered design that separates concerns between entity definitions, database operations, and query building.

## System Architecture

### Core Architecture Pattern

The framework follows Entity Framework's architectural patterns with a layered approach:

- **Entity Layer**: Decorator-based entity definitions with metadata reflection
- **Context Layer**: DbContext manages entity sets, change tracking, and database operations
- **Provider Layer**: Pluggable database provider architecture (supports SQLite, PostgreSQL, MSSQL, MySQL)
- **Query Layer**: LINQ-style query building with method chaining

### Decorator-Based Metadata System

Uses TypeScript decorators and reflect-metadata for entity configuration:

- `@Entity()` marks classes as database entities
- `@Column()` defines column properties and constraints
- `@PrimaryKey()` designates primary key fields
- `@OneToMany()` and `@ManyToOne()` define relationships
- MetadataStorage centrally manages all entity metadata

### Change Tracking Implementation

Implements Entity Framework's change tracking pattern:

- ChangeTracker monitors entity states (Added, Modified, Deleted, Unchanged)
- DbSet provides Add/Update/Remove operations that update tracking state
- SaveChanges() processes all tracked changes in a single transaction

### Database Provider Abstraction

Abstract DatabaseProvider base class enables multiple database support:

- Implemented providers: SQLite (sqlite3), PostgreSQL (pg), MSSQL (mssql), MySQL (mysql2)
- Provider handles connection management, SQL generation, and query execution
- Clean separation allows adding more providers later

### Query Layer (Queryable + QueryBuilder)

LINQ-style query building with method chaining is provided by `Queryable`, while SQL generation is handled by a dedicated `QueryBuilder` using a pluggable `SqlDialect`.

- `where` parses simple lambda predicates into a minimal AST (via `PredicateParser`) and generates SQL with `SqlVisitor`; for unsupported cases it falls back to in-memory filtering
- `select` projects fields
- `orderBy` / `orderByDescending` apply sorting
- `take` / `skip` add pagination
- `include` supports predicate-based eager loading; call it first in the chain (before `where/select/orderBy`) to ensure it is applied

This separation improves testability and extensibility. The AST + visitor pipeline enables SQL generation where possible, while keeping runtime semantics correct via safe fallbacks.

### Advanced Indexes

Indexes can be declared via the `@Index` decorator (Stage‑3) or registered programmatically via `MetadataStorage.addIndex(...)`.

Options supported (provider‑agnostic metadata):

- `columns: string[]` — columns participating in the index
- `unique: boolean` — uniqueness
- `where?: string` — partial/filtered predicate (PG/SQLite/MSSQL; ignored on MySQL)
- `orders?: { [column]: 'ASC' | 'DESC' }` — per‑column order
- `expressions?: string[]` — raw SQL expressions as key parts (PG/MySQL/SQLite)
- `collations?: { [column]: string }` — per‑column collation (PG/SQLite)
- `nulls?: { [column]: 'FIRST' | 'LAST' }` — NULLS ordering (PG)

Example:

```ts
@Entity()
@Index('idx_users_active', ['active'], { where: 'active = true' })
@Index('idx_users_email_ci', ['email'], { collations: { email: 'NOCASE' } })
@Index('idx_users_created_ord', ['createdAt'], {
  orders: { createdAt: 'DESC' },
  nulls: { createdAt: 'LAST' }
})
@Index('idx_users_email_expr', [], { expressions: ['LOWER(email)'] })
class User {
  @PrimaryKey() id!: number;
  @Column() email!: string;
  @Column() active!: boolean;
  @Column() createdAt!: Date;
}
```

Migration diff detects new/changed/dropped indexes and emits dialect‑specific SQL:

- Postgres: `CREATE [UNIQUE] INDEX IF NOT EXISTS ... (col [ASC|DESC] [COLLATE ...] [NULLS ...], (expr)) [WHERE ...]`
- SQLite: `CREATE [UNIQUE] INDEX IF NOT EXISTS ... (col [ASC|DESC] [COLLATE ...], (expr)) [WHERE ...]`
- MySQL: `CREATE [UNIQUE] INDEX IF NOT EXISTS ... (col [ASC|DESC], (expr))` (partial ignored)
- MSSQL: `CREATE [UNIQUE] INDEX ... ON ... (col [ASC|DESC]) [WHERE ...]`

Notes:

- MySQL ignores partial `WHERE` in index options.
- Expressions support depends on engine/version; ensure compatibility for your target DB.
- When index shape changes, generator emits DROP + CREATE with dialect‑specific DROP syntax.

IndexOptionsBuilder (fluent):

```ts
// Import рядом с декораторами
import { Index, IndexOptionsBuilder } from '@ts-linq/core/decorators';

@Entity()
@Index(
  new IndexOptionsBuilder('idx_users_email_created')
    .onColumns(['email', 'createdAt'])
    .unique()
    .orderBy({ email: 'ASC', createdAt: 'DESC' })
)
class User {
  @PrimaryKey() id!: number;
  @Column() email!: string;
  @Column() createdAt!: Date;
}

// Также доступен импорт из utils:
// import { IndexOptionsBuilder } from '@ts-linq/core/utils';
```

### Computed Columns vs Default Expressions

Computed (generated) columns вычисляются базой по выражению и считаются read‑only в ORM. В отличие от `defaultExpression`, которое подставляет значение только при INSERT, computed пересчитывается на стороне БД при изменении зависимых столбцов.

Правила и ограничения:

- Computed колонки исключены из INSERT/UPDATE; попытка записи вызывает ValidationError.
- Нельзя сочетать `isComputed` с `defaultValue`/`defaultExpression`/`isGenerated`/`isVersion`.
- Миграции: изменение computed выполняется как drop+add (для SQLite прямой DROP COLUMN недоступен; требуется перестройка таблицы вне scope минимального диффа).

Поддержка диалектов (storage):

- PostgreSQL: только STORED (`GENERATED ALWAYS AS (...) STORED`).
- MySQL ≥ 5.7: `VIRTUAL` и `STORED`.
- SQLite ≥ 3.31: `VIRTUAL`/`STORED` (в проекте по умолчанию VIRTUAL; при старых версиях выводится предупреждение и/или тесты пропускаются).
- MSSQL: `AS (...)` c опцией `PERSISTED` при необходимости материализации.

Пример регистрации без декораторов:

```ts
MetadataStorage.addEntity(Order, 'orders');
MetadataStorage.addColumn(Order, {
  propertyName: 'totalWithVat',
  columnName: 'total_with_vat',
  type: 'INTEGER',
  nullable: true,
  isComputed: true,
  computedExpression: 'amount * 1.2'
});
MetadataStorage.addPrimaryKey(Order, 'id');
```

### Migration Framework

Code-first database evolution support:

- Abstract Migration base class for schema changes
- MigrationRunner manages migration execution order
- Up/Down methods for forward and rollback operations

Advanced building blocks:

- DiffBasedMigration (Template Method) — генерирует up/down из SchemaDiff с хуками `before/after` для всего этапа и каждой SQL-команды (можно скипать отдельные шаги)
- MigrationBuilder (fluent) — сборка SchemaDiff: create/alter/drop column, create/drop index, add/drop FK, rename table/column
- MigrationFileBuilder — генерация TypeScript‑класса миграции из SchemaDiff (с up/down)

## External Dependencies

### Core Dependencies

- **sqlite3**: Primary database engine for SQLite provider
- **reflect-metadata**: Enables TypeScript decorator metadata reflection
- **typescript**: TypeScript compiler and type definitions

### Development Dependencies

- **jest**: Testing framework with comprehensive test coverage
- **ts-jest**: TypeScript preprocessor for Jest
- **ts-node**: TypeScript execution environment for Node.js
- **@types/node**: Node.js type definitions
- **@types/sqlite3**: SQLite3 type definitions
- **@types/jest**: Jest type definitions

### Runtime Requirements

- Node.js with ES2020 support
- TypeScript experimental decorators enabled
- Reflect metadata polyfill loaded before entity definitions

## Documentation

This section walks you through using the framework with TypeScript examples.

### Installation

```bash
npm install reflect-metadata typescript ts-node sqlite3
# Optional peer deps per provider:
# PostgreSQL
npm install pg
# MSSQL
npm install mssql
# MySQL
npm install mysql2
```

Enable decorators in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2020",
    "module": "commonjs"
  }
}
```

Load reflect-metadata before entity definitions:

```ts
import 'reflect-metadata';
```

### Quick Start

```ts
import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from './src';

@Entity()
class Product {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ nullable: false }) name!: string;
}

class AppDbContext extends DbContext {
  public products!: DbSet<Product>;
}

async function main() {
  const ctx = new AppDbContext({ connectionString: ':memory:', provider: 'sqlite' });
  await ctx.ensureCreated();

  const p = new Product();
  p.name = 'Laptop';
  ctx.products.add(p);
  await ctx.saveChanges();

  const all = await ctx.products.toArray();
  console.log(all.length); // 1

  await ctx.dispose();
}
main();
```

### Entities

```ts
@Entity()
class Author {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ nullable: false }) name!: string;
}
```

Relationships are supported:

```ts
@Entity()
class Book {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ nullable: false }) title!: string;
  @Column() authorId!: number;
}

@Entity()
class Author {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ nullable: false }) name!: string;
  @OneToMany(() => Book, { foreignKey: 'authorId' }) books!: Book[];
}
```

### DbContext and DbSet

```ts
class AppDbContext extends DbContext {
  public authors!: DbSet<Author>;
  public books!: DbSet<Book>;
}
```

Note about auto-generated DbSet properties:

- For each registered entity class, a property is created on the context using a simple convention: `<ClassName>.toLowerCase() + 's'` with a basic `y → ies` rule.
- Examples: `Author` → `authors`, `Book` → `books`, `Category` → `categories`.
- If you need a different name, either use `set(YourEntity)` or add your own getter that delegates to `set(YourEntity)`.

You can always use `context.set(Author)` if you prefer not to declare properties.

### CRUD via DbSet

```ts
// Create
const b = new Book();
b.title = 'First Book';
b.authorId = author.id;
context.books.add(b);
await context.saveChanges();

// Read
const found = await context.books.find(b.id);

// Update
found!.title = 'Updated';
context.books.update(found!);
await context.saveChanges();

// Delete
context.books.remove(found!);
await context.saveChanges();
```

### Type Safety for IDs (branded types)

```ts
import { EntityId, brandId } from './src';

// Define branded aliases
type UserId = EntityId<number, 'User'>;

@Entity()
class User {
  @PrimaryKey({ autoIncrement: true }) id!: UserId; // branded PK
  @Column({ nullable: false }) name!: string;
}

// Using DbSet.find with branded id
const id = brandId<number, 'User'>(123);
const user = await context.users.find(id);

// Fetch many by ids efficiently (IN query under the hood)
const many = await context.users.findByIds([id]);
```

### LINQ-style Queries

```ts
// Filtering, sorting, pagination
const page = await context.books
  .where((b) => b.title === 'Updated')
  .orderBy((b) => b.id)
  .skip(0)
  .take(10)
  .toArray();

// Aggregations and checks
const total = await context.books.count();
const any = await context.books.where((b) => b.title === 'X').any();

// First/Single
const first = await context.books.orderBy((b) => b.id).first();
const maybe = await context.books.where((b) => b.id > 999).firstOrDefault();

// Result-based try-variants (no exceptions):
const firstRes = await context.books.orderBy((b) => b.id).tryFirst();
if (firstRes.ok) {
  /* use firstRes.value */
} else {
  /* handle firstRes.error */
}
const singleRes = await context.books.where((b) => b.id === 1).trySingle();

// Joins (inner/left)
const joined = await context.authors
  .innerJoin(Book, (a, b) => a.id === b.authorId)
  .where((a) => a.id >= 1)
  .toArray();
```

Include-first chaining (eager loading):

```ts
const authors = await context.authors
  .include((a) => a.books) // declare eager includes first
  .where((a) => a.id === 1)
  .toArray();
```

### Eager vs Lazy Loading

By default loading is Lazy. Use `include` for eager loading:

```ts
// Eager load authors with books via predicate-based include
const authors = await context.authors.include((a) => a.books).toArray();

// Depth control (context API still accepts options)
import { LoadingStrategy } from './src';
const one = await context.find(Author, 1, {
  strategy: LoadingStrategy.Eager,
  depth: 1,
  includes: ['books']
});
```

Note: when loading collections (e.g., one-to-many) for multiple parent rows, the loader batches queries internally to avoid the N+1 problem (uses IN clauses under the hood). Predicate-based include chaining can be combined with where/order/take.

### Pagination

Offset-based pagination и keyset-пагинация из коробки:

```ts
// Offset-based: paginate(page, size) возвращает { items, total, page, size }
const page1 = await context.books.orderBy((b) => b.id).paginate(1, 20);

// Keyset-based: быстрая пагинация по монотонному ключу
const first = await context.books.orderBy((b) => b.id).keysetPaginate('id', null, 20);
const next = await context.books.orderBy((b) => b.id).keysetPaginate('id', first.nextAfter, 20);
```

### Transactions

```ts
await context.beginTransaction();
try {
  // multiple operations
  await context.saveChanges();
  await context.commitTransaction();
} catch (e) {
  await context.rollbackTransaction();
}

// Result-based save without throwing
const res = await context.trySaveChanges();
if (!res.ok) {
  // handle res.error
}
```

### Migrations

```ts
import { SQLiteProvider, Migration, MigrationRunner } from './src';

const provider = new SQLiteProvider(':memory:');
await provider.connect();

class AddAgeToUsers extends Migration {
  protected get name() {
    return 'AddAgeToUsers';
  }
  protected get version() {
    return '002';
  }
  public async up() {
    await provider.executeNonQuery('ALTER TABLE users ADD COLUMN age INTEGER');
  }
  public async down() {
    // For SQLite you would typically recreate the table without the column (simplified here)
  }
}
const runner = new MigrationRunner(provider);
runner.addMigration(new AddAgeToUsers());
await runner.migrate();
```

Fluent‑diff и генерация классов:

```ts
import { MigrationBuilder, MigrationFileBuilder } from './src';

const diff = new MigrationBuilder()
  .createTable('users', (t) => {
    t.column('id', 'INTEGER', { nullable: false }).primaryKey('id');
    t.column('name', 'TEXT', { nullable: false }).index('idx_users_name', ['name']);
  })
  .addForeignKey('orders', {
    columns: ['user_id'],
    refTable: 'users',
    refColumns: ['id'],
    onDelete: 'CASCADE'
  })
  .renameTable('temp_users', 'users')
  .renameColumn('users', 'name', 'full_name')
  .toDiff();

const { filename, source } = MigrationFileBuilder.build(diff, {
  className: 'CreateUsersAndOrders',
  version: '001',
  dialect: 'postgresql'
});
// save source to migrations/001_CreateUsersAndOrders.ts and register it in MigrationRunner
```

### Database Providers

Providers implemented: `SQLiteProvider`, `PostgresProvider`, `MssqlProvider`, `MySqlProvider`.

A provider is responsible for:

- connecting/disconnecting
- SQL generation (DDL/DML)
- query execution
- transactions

New providers can be added by implementing the abstract `DatabaseProvider`.

### Optimistic Concurrency

Поддерживается оптимистическая блокировка через версионную колонку. Пометьте поле версии у сущности и ORM будет:

- при `UPDATE` инкрементировать версию,
- требовать совпадение текущей версии в `WHERE`,
- выбрасывать `OptimisticConcurrencyError` при рассогласовании.

```ts
@Entity({ name: 'Items' })
class Item {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'INTEGER', nullable: false, version: true }) version!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

// update: WHERE id = ? AND version = ?; SET version = version + 1
// при конфликте будет ошибка OptimisticConcurrencyError
```

### PostgreSQL

PostgreSQL support is provided via a dedicated provider and dialect.

- Install peer dependency:

```bash
npm install pg
```

- Use provider 'postgresql' in your context options (connection string from env is recommended):

```ts
class AppDbContext extends DbContext {
  public users!: DbSet<User>;
}

const ctx = new AppDbContext({
  provider: 'postgresql',
  connectionString: process.env.POSTGRES_URL || 'postgres://user:pass@localhost:5432/db'
});
```

- Differences vs SQLite:
  - Parameter placeholders use $1..$n instead of '?'.
  - `findWhereIn` uses `= ANY($1)` with array parameters.
  - Types mapping includes TIMESTAMPTZ/JSONB. Basic conversions are applied on read.
  - DDL creation is simplified; prefer migrations for production schemas.

- Running tests with PostgreSQL:
  - Set `POSTGRES_URL` and run `npm test` — Postgres-specific suite will be enabled automatically.

- Quick docker-compose for local Postgres:

```yaml
version: '3.8'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_USER: postgres
      POSTGRES_DB: ts_linq
    ports:
      - '5432:5432'
```

Then set `POSTGRES_URL=postgres://postgres:postgres@localhost:5432/ts_linq`.

### Microsoft SQL Server (MSSQL)

MSSQL support is provided via a dedicated provider and dialect.

- Install peer dependency:

```bash
npm install mssql
```

- Use provider 'mssql' in your context options (set connection string via env):

```ts
class AppDbContext extends DbContext {
  public users!: DbSet<User>;
}

const ctx = new AppDbContext({
  provider: 'mssql',
  connectionString:
    process.env.MSSQL_URL ||
    'Server=localhost;Database=ts_linq;User Id=sa;Password=Your_password123;Encrypt=false'
});
```

- Differences vs SQLite:
  - Parameter placeholders use `@p1..@pn` instead of `?`.
  - Auto-increment retrieval uses `SCOPE_IDENTITY()` after INSERT (or OUTPUT clause).
  - Types mapping includes `UNIQUEIDENTIFIER`, `NVARCHAR(MAX)`, `VARBINARY(MAX)`, `BIT`, `DATETIME2`.
  - DDL creation uses `IF NOT EXISTS` checks against `sys.tables`/`sys.indexes`.

- Running tests with MSSQL:
  - Set `MSSQL_URL` and run `npm test` — MSSQL-specific suite will be enabled automatically.

- Quick docker-compose for local MSSQL:

```yaml
version: '3.8'
services:
  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: 'Y'
      SA_PASSWORD: 'Your_password123'
    ports:
      - '1433:1433'
```

Then set `MSSQL_URL=Server=localhost;Database=ts_linq;User Id=sa;Password=Your_password123;Encrypt=false`.

#### Example (CRUD)

```ts
@Entity({ name: 'Users' })
class User {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class MsCtx extends DbContext {
  public users!: DbSet<User>;
  constructor() {
    super({ provider: 'mssql', connectionString: process.env.MSSQL_URL! });
  }
}

const ctx = new MsCtx();
await ctx.ensureCreated();
const u = new User();
u.name = 'Alice';
ctx.users.add(u);
await ctx.saveChanges();
const all = await ctx.users.toArray();
await ctx.dispose();
```

#### Example (JOIN + Include)

```ts
// JOIN (inner)
const rows = await ctx.users
  .innerJoin(Order, (u, o) => u.id === o.userId)
  .where((u) => u.id >= 1)
  .toArray();

// Eager Include (include-first)
const withOrders = await ctx.users
  .include((u) => u.orders)
  .where((u) => u.id === 1)
  .toArray();
```

#### Example (Upsert)

```ts
// Insert or update depending on PK presence/conflict
const user = new User();
user.id = 1; // when PK provided, becomes an update if exists
user.name = 'Alice';
await ctx.provider.upsert(user, User);
```

### MySQL

MySQL support is provided via a provider and dialect.

- Install peer dependency:

```bash
npm install mysql2
```

- Use provider 'mysql' (set connection string via env):

```ts
class AppDbContext extends DbContext {
  public users!: DbSet<User>;
}

const ctx = new AppDbContext({
  provider: 'mysql',
  connectionString: process.env.MYSQL_URL || 'mysql://root:password@localhost:3306/ts_linq'
});
```

- Differences vs SQLite:
  - Uses positional `?` parameters.
  - LIMIT/OFFSET syntax is supported (`LIMIT n OFFSET m`).
  - Types mapping: `INT`, `DOUBLE`, `TINYINT(1)`→boolean, `DATETIME`, `BLOB`.

- Running tests with MySQL:
  - Set `MYSQL_URL` and run `npm test` — MySQL suite will be enabled automatically.

- Quick docker-compose for local MySQL:

```yaml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: ts_linq
    ports:
      - '3306:3306'
```

#### Example (CRUD)

```ts
@Entity({ name: 'Users' })
class User {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class MyCtx extends DbContext {
  public users!: DbSet<User>;
  constructor() {
    super({ provider: 'mysql', connectionString: process.env.MYSQL_URL! });
  }
}

const ctx = new MyCtx();
await ctx.ensureCreated();
const u = new User();
u.name = 'Bob';
ctx.users.add(u);
await ctx.saveChanges();
const all = await ctx.users.toArray();
await ctx.dispose();
```

#### Example (JOIN + Include)

```ts
// JOIN (left)
const rows = await ctx.users
  .leftJoin(Order, (u, o) => u.id === o.userId)
  .where((u) => u.id > 0)
  .toArray();

// Eager Include (include-first)
const withOrders = await ctx.users
  .include((u) => u.orders)
  .where((u) => u.name === 'Bob')
  .toArray();
```

#### Example (Upsert)

```ts
const user = new User();
user.id = 42;
user.name = 'Bob';
await ctx.provider.upsert(user, User);
```

#### SQL Logging

You can supply a `logger` in `DbContextOptions` to receive query lifecycle events with timings and optional transaction trace ids:

```ts
import { SqlLogger } from './src/types';

const logger: SqlLogger = {
  queryStart: ({ sql, params, traceId }) => console.log('sql:start', traceId, sql, params),
  queryEnd: ({ sql, durationMs, error }) => console.log('sql:end', durationMs, error?.message)
};

const ctx = new AppDbContext({ connectionString: ':memory:', provider: 'sqlite', logger });
```

#### Connection Pooling & Health-Check (ENV)

Опции пула и health-check можно настроить через ENV (CLI factory) или через конструктор провайдера:

ENV (CLI):

```bash
# Pool
export DB_POOL_MIN=2
export DB_POOL_MAX=20
export DB_POOL_IDLE_MS=30000
export DB_POOL_ACQUIRE_MS=5000
export DB_CONN_TIMEOUT_MS=10000

# Health-check
export DB_HEALTH_ENABLED=true
export DB_HEALTH_INTERVAL_MS=60000
export DB_HEALTH_TIMEOUT_MS=5000
export DB_HEALTH_TEST_QUERY='SELECT 1'
# Backoff/статусы
export DB_HEALTH_MIN_INTERVAL_MS=1000
export DB_HEALTH_MAX_INTERVAL_MS=10000
export DB_HEALTH_DEGRADE_AFTER=3
export DB_HEALTH_UNHEALTHY_AFTER=6
```

Конструктор провайдера (прямой вызов):

```ts
import { PostgresProvider } from '@ts-linq/postgres';
import { ConnectionPoolOptions, ConnectionHealthCheckOptions } from '@ts-linq/core';

const pool: ConnectionPoolOptions = {
  min: 2,
  max: 20,
  idleTimeoutMs: 30000,
  acquireTimeoutMs: 5000,
  connectionTimeoutMs: 10000
};
const health: ConnectionHealthCheckOptions = {
  enabled: true,
  testQuery: 'SELECT 1',
  timeoutMs: 5000,
  minIntervalMs: 1000,
  maxIntervalMs: 10000,
  degradeAfterFailures: 3,
  unhealthyAfterFailures: 6
};

const provider = new PostgresProvider(process.env.POSTGRES_URL!, undefined, undefined, undefined, undefined, pool, health);
```

Composite логгеры (композиция Prometheus + OTEL или других):

```ts
import { CompositeSqlLoggerFactory } from 'composite-sql-logger';
import { OpenTelemetrySqlLogger } from 'open-telemetry-sql-logger';
import { PrometheusSqlLogger } from 'prometheus-sql-logger';

const factory = new CompositeSqlLoggerFactory({
  loggers: [
    new OpenTelemetrySqlLogger('orders-service'),
    new PrometheusSqlLogger('orders-service', { prefix: 'tsl_' })
  ]
});

const ctx = new AppDbContext({
  connectionString: ':memory:',
  provider: 'sqlite',
  loggerFactory: factory
});
```

OpenTelemetry (optional):

```ts
import { OpenTelemetrySqlLogger } from 'open-telemetry-sql-logger';

const ctx = new AppDbContext({
  connectionString: process.env.POSTGRES_URL!,
  provider: 'postgresql',
  logger: new OpenTelemetrySqlLogger('orders-service')
});
// Все запросы появятся как спаны в вашей трассировке (Jaeger/Tempo/DD и т.п.)
```

Prometheus (optional):

```ts
import { PrometheusSqlLogger } from 'prometheus-sql-logger';

// If prom-client is installed, metrics will be recorded; otherwise this is a no-op
const promLogger = new PrometheusSqlLogger('orders-service', { prefix: 'tsl_' });

const ctx = new AppDbContext({
  connectionString: ':memory:',
  provider: 'sqlite',
  logger: promLogger
});

// Exposing /metrics is up to the host app. Example with prom-client (pseudo):
// import * as client from 'prom-client';
// app.get('/metrics', async (_req, res) => {
//   res.set('Content-Type', client.register.contentType);
//   res.end(await client.register.metrics());
// });
```

Prometheus dashboards & PromQL (examples):

- Buckets (histogram): tune `bucketsMs` by target latency (p95 around middle buckets). For low-latency SQLite use tighter buckets (e.g., [2, 5, 10, 20, 50, 100]). For network DBs add higher buckets (e.g., up to 2000ms).
- Label cardinality: keep `entity` low-cardinality (table names). Avoid high-cardinality labels like raw SQL or user ids.

Example PromQL:

```promql
# Total queries per provider (rate)
sum by (provider) (rate(db_query_total[5m]))

# Error rate by provider
sum by (provider) (rate(db_error_total[5m]))
  /
sum by (provider) (rate(db_query_total[5m]))

# p95 query duration in milliseconds by provider
histogram_quantile(0.95, sum by (le, provider) (rate(db_query_duration_ms_bucket[5m])))

# p99 query duration in milliseconds by provider
histogram_quantile(0.99, sum by (le, provider) (rate(db_query_duration_ms_bucket[5m])))

# Cache hit ratio (sqlGen)
sum(rate(db_cache_hits_total{cache="sqlGen"}[5m]))
  /
(sum(rate(db_cache_hits_total{cache="sqlGen"}[5m])) + sum(rate(db_cache_misses_total{cache="sqlGen"}[5m])))

# Retries per second
sum(rate(db_retry_total[5m]))

# Active transactions gauge by provider
db_active_transactions

# Health-check
# Health status (1/0) by provider and status label (healthy/degraded/unhealthy)
db_connection_health

# Health-check latency (p95)
histogram_quantile(0.95, sum by (le, provider, status) (rate(db_connection_latency_ms_bucket[5m])))

# Connection degraded gauge (1 when provider is degraded)
db_connection_degraded

# Status transitions rate
sum by (provider, from, to) (rate(db_connection_status_transitions_total[5m]))
```

Dashboard hints:

- Overview: query rate, error rate, p50/p95 latency (by provider), active transactions.
- Cache: sqlGen hit ratio, entityL2 hit ratio, count cache hit ratio.
- Top entities: split duration/throughput by `entity` (limit panels to top N to avoid cardinality blow-up).
- Tracing linkage: if exemplars enabled, use Prometheus+Tempo/Grafana to jump from latency samples to traces.

Alerting (recommended):

- Purpose: detect latency/error spikes early; keep bucket config realistic to your SLOs.
- Core signals:
  - p95/p99 latency: `db_query_duration_ms_bucket`
  - Error rate: `db_error_total / db_query_total`
  - Retries: `db_retry_total`
  - Cache health: `db_cache_hits_total`, `db_cache_misses_total`, `db_cache_evictions_total`, `db_cache_size`
  - Count cache detail: `db_count_cache_ttl_hits_total`, `db_count_cache_hard_hits_total`

PromQL snippets:

```promql
# p95 / p99 latency by provider (5m window)
histogram_quantile(0.95, sum by (le, provider) (rate(db_query_duration_ms_bucket[5m])))
histogram_quantile(0.99, sum by (le, provider) (rate(db_query_duration_ms_bucket[5m])))

# Error rate by provider
sum by (provider) (rate(db_error_total[5m])) / sum by (provider) (rate(db_query_total[5m]))

# Retry rate (ops/s)
sum by (provider) (rate(db_retry_total[5m]))

# Cache hit ratio (count cache)
sum(rate(db_cache_hits_total{cache="count"}[5m]))
/ (sum(rate(db_cache_hits_total{cache="count"}[5m])) + sum(rate(db_cache_misses_total{cache="count"}[5m])))

# Cache evictions (capacity pressure)
sum by (provider, cache) (rate(db_cache_evictions_total[5m]))

# Count cache hits breakdown
sum by (provider) (rate(db_count_cache_ttl_hits_total[5m]))
sum by (provider) (rate(db_count_cache_hard_hits_total[5m]))
```

Alertmanager examples (tune thresholds per env):

```yaml
groups:
  - name: ts-linq-alerts
    rules:
      - alert: DbP95LatencyHigh
        expr: histogram_quantile(0.95, sum by (le, provider) (rate(db_query_duration_ms_bucket[5m]))) > 0.2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'DB p95 latency high (>200ms)'
          description: 'Provider {{ $labels.provider }} p95 > 200ms for 10m'

      - alert: DbErrorRateHigh
        expr: (sum by (provider) (rate(db_error_total[5m])) / sum by (provider) (rate(db_query_total[5m]))) > 0.01
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: 'DB error rate >1%'
          description: 'Provider {{ $labels.provider }} error rate > 1% for 10m'

      - alert: DbRetriesSpike
        expr: sum by (provider) (rate(db_retry_total[5m])) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'DB retries elevated'
          description: 'Provider {{ $labels.provider }} retries > 1 rps for 10m'

      - alert: DbCacheEvictionsHigh
        expr: sum by (provider, cache) (rate(db_cache_evictions_total[5m])) > 10
        for: 15m
        labels:
          severity: info
        annotations:
          summary: 'DB cache evictions high'
          description: '{{ $labels.cache }} cache under pressure for {{ $labels.provider }}'
```

Notes:

- Keep label cardinality low; prefer `provider`, optional `entity` if bounded.
- Tune histogram buckets (`bucketsMs`) so that target p95 lies inside observed buckets.

Exemplars (traceId):

- When `traceId` is available, `PrometheusSqlLogger` attaches it as an exemplar to `db_query_duration_ms` (if your `prom-client` supports exemplars, v14+). This enables linking metrics samples to traces in backends that support exemplars (e.g., Tempo, Grafana LGTM).
- No hard dependency: if exemplars are not supported, metrics still record without them.

### Extended LINQ

Subqueries and unions are supported in addition to joins and includes:

```ts
// Subquery IN (typed)
const sub = ctx.orderItems.select((oi) => ({ productId: oi.productId }));
const popular = await ctx.products.whereInSubquery('id', sub).toArray();

// UNION
const q1 = ctx.products.where((p) => p.price <= 10);
const q2 = ctx.products.where((p) => p.price >= 1000);
const extremes = await q1.clone().union(q2).toArray();
```

### SQL Dialects

The query layer is decoupled from SQL generation via a dialect strategy:

- `SqlDialect` interface defines how to build SELECT queries from `QueryOptions`.
- `SQLiteDialect` is the default implementation used by `QueryBuilder`.

To provide a custom dialect (e.g., PostgreSQL), implement `SqlDialect` and pass it to `QueryBuilder` or wire it in your provider:

```ts
import { QueryBuilder } from './src/query/QueryBuilder';
import { SqlDialect } from './src/query/SqlDialect';

class PostgresDialect implements SqlDialect {
  buildSelect(entityClass, options) {
    // return { query, parameters }
    throw new Error('Not implemented');
  }
}

const qb = new QueryBuilder(new PostgresDialect());

// QueryBuilder cache utilities
QueryBuilder.clearCache(); // clears global SQL cache
```

### Retry Policies

Можно управлять ретраями через стратегию `RetryPolicy` (инъекция через `DbContextOptions.retryPolicy`). Доступны:

- ExponentialBackoffRetryPolicy — экспоненциальная задержка с джиттером
- FixedIntervalRetryPolicy — фиксированный интервал между попытками
- NoRetryPolicy — без ретраев

```ts
import { FixedIntervalRetryPolicy } from './src/utils/RetryPolicies';

const ctx = new AppDbContext({
  provider: 'sqlite',
  connectionString: ':memory:',
  retryPolicy: new FixedIntervalRetryPolicy(100)
});
```

### Provider Hooks

`DatabaseProvider` exposes template-method hooks around execution for cross-cutting concerns:

- `beforeExecute(sql, params)` — called before each query/non-query
- `afterExecute(sql, params, result)` — called after execution

Override these in a custom provider (or subclass) for logging, tracing, caching, metrics, etc.

### Performance Options & External Caches

You can inject external caches via `DbContextOptions.performance` for fine control over limits/TTL:

```ts
import { InMemorySqlCache } from './src/query/SqlCache';
import { InMemoryCountCache } from './src/query/CountCache';

const ctx = new AppDbContext({
  provider: 'sqlite',
  connectionString: ':memory:',
  performance: {
    enableEntityCache: true,
    entityCacheSize: 20_000,
    enableCountCache: true,
    countCacheTtlMs: 10_000,
    countCache: new InMemoryCountCache(10_000 /* ttl */, 5_000 /* maxSize */),
    sqlCache: new InMemorySqlCache(2_000)
  }
});
```

Benchmarks & profiling:

- Quick: `npm run bench` (SQLite)
- Multi: `npm run bench:multi` (env: `POSTGRES_URL`, `MYSQL_URL`, `BENCH_PROVIDERS=sqlite,postgresql,mysql`, `BENCH_FORMAT=csv|json`)
- Profiling: `npm run bench:profile:cpu`, `npm run bench:profile:heap` (Node CPU/Heap profiles)

Best Practices (PerformanceOptions & metrics):

- L2 cache: включайте при чтениях по PK и повторном доступе к тем же сущностям; начинайте с `entityCacheSize: 10k–20k`.
- SQL gen cache: типичные размеры 1–2k; LRU (по умолчанию) помогает защитить горячие ключи.
- Count cache: задайте `enableCountCache` и `countCacheTtlMs` (например 5–30s) для пагинации; избегайте на быстро меняющихся наборах.
- Внешние кэши: используйте инъекцию `sqlCache`/`countCache` для тонкой настройки (лимиты/TTL, разделение на контексты).
- Buckets (гистограмма):
  - SQLite (in‑proc): `[2, 5, 10, 20, 50, 100]` (цель p95 в середине диапазона)
  - Postgres/MySQL (сеть): добавьте высокие значения до 1000–2000ms
- Alerting (ориентиры, корректируйте под SLO):
  - p95: предупреждение > 200ms (10m), критично > 500ms (10m) для сетевых БД; для SQLite ниже (например 50/100ms)
  - Error rate: предупреждение > 1% (10m), критично > 5% (10m)
  - Retries: «шум» > 1 rps по провайдеру (10m)

### Clean Code & Typing

- Strict TypeScript enabled; public APIs and internal models have explicit types
- `QueryModel` is cloned for read-only operations to avoid mutation during `first/any/...`
- Predicate-based includes are validated against entity metadata at runtime

### Specifications

Use the Specification pattern to compose reusable filters that can be evaluated in-memory and (when possible) translated to SQL:

```ts
import { PredicateParser } from './src/query/PredicateParser';
import { PredicateSpecification, Specs } from './src/query/spec/Specification';

const parser = new PredicateParser<Author>();
const byId = new PredicateSpecification<Author>(
  (a) => a.id === 1,
  parser.parse((a) => a.id === 1)
);
const hasName = new PredicateSpecification<Author>(
  (a) => a.name === 'Jane',
  parser.parse((a) => a.name === 'Jane')
);
const spec = Specs.and(byId, hasName);
// spec.toExpression() → AST (may be converted to SQL), spec.test(a) → boolean
```

### Typing Tips

- Prefer explicit DbSet properties in your context: `public books!: DbSet<Book>;` for better IntelliSense and types.
- Use `set(Entity)` when your property name differs from the convention or when you don't want to declare properties.

### Examples

- Simple app: `examples/simple-app.ts`
- Advanced queries: `examples/advanced-queries.ts`

### Distribution (ESM/CJS)

The package ships dual builds:

- CJS: `dist/cjs`, main entry `package.json#main`
- ESM: `dist/esm`, module entry `package.json#module`
- Types: `dist/types`

Node and bundlers will pick the right build via `exports`.

### API Docs (TypeDoc)

- Generate HTML documentation:

```bash
npm run docs
```

- Output will be in the `docs/` folder. Open `docs/index.html` in a browser.
- The generator uses `src/index.ts` as the entry point and includes public and private APIs. If you see warnings about referenced types not included, consider exporting those types from `src/index.ts` or ignore the warnings.
- Contribution & Architecture: see `CONTRIBUTING.md` and `docs/guides/architecture.md`.

### Guides

- Diff migrations: `docs/guides/diff-migrations.md`
- Upsert & batch: `docs/guides/upsert-batch.md`
- Advanced include & joins: `docs/guides/advanced-include-join.md`
- Test matrix: `docs/guides/test-matrix.md`
- Conditional validation: `docs/guides/conditional-validation.md`
- Database functions (defaults): `docs/guides/database-functions.md`
- NestJS integration: `docs/guides/nestjs-integration.md`

### CLI (experimental)

Минимальная CLI-утилита для SQLite.

```bash
# Печать SQL-диффа текущей схемы (по умолчанию :memory:)
npx ts-node src/bin/ts-linq-cli.ts

# Применить SQL-дифф к БД
SQLITE_URL="file:./dev.sqlite" npx ts-node src/bin/ts-linq-cli.ts migrate

# Сгенерировать файл миграции в ./migrations
npx ts-node src/bin/ts-linq-cli.ts generate AddNewTable

# Применить сиды из файла (по умолчанию ./seeds.sql)
SQLITE_URL="file:./dev.sqlite" npx ts-node src/bin/ts-linq-cli.ts seed ./seeds.sql
```

Примечания:

- Переменная окружения `SQLITE_URL` указывает строку подключения. По умолчанию `:memory:`.
- Команда `rollback` для дифф-подхода не поддерживается: используйте сгенерированные миграции с явными `down()` шагами.

## Circuit Breaker

Ts-Linq ORM поддерживает Circuit Breaker на уровне `DatabaseProvider` для повышения устойчивости при массовых сбоях БД и предотвращения каскадных отказов.

- Состояния: `closed` → `open` → `half-open` → `closed`.
- В `open` все вызовы short-circuit'ятся с ошибкой `CircuitOpenError` до истечения `openDurationMs`.
- По истечении интервала — состояние `half-open` и допускаются ограниченные пробные вызовы.
- Успех в `half-open` закрывает брейкер; ошибка — снова открывает на интервал.

### Опции

```ts
export interface CircuitBreakerOptions {
  enabled?: boolean;          // включить/выключить (по умолчанию true)
  failureThreshold?: number;  // порог последовательных ошибок для открытия (по умолчанию 5)
  openDurationMs?: number;    // длительность open до half-open (по умолчанию 30000)
  halfOpenMaxCalls?: number;  // число параллельных проб в half-open (по умолчанию 1)
  countTransientOnly?: boolean; // учитывать только транзиентные ошибки (по умолчанию true)
}
```

### Подключение

Вы можете передать опции при создании провайдера (конструктор `DatabaseProvider` принимает `circuitOptions` последним параметром в конкретных провайдерах) или настроить их в рантайме:

```ts
provider.configureCircuit({ failureThreshold: 3, openDurationMs: 15000 });
```

Текущее состояние доступно через геттер:

```ts
const state = provider.circuitStateLabel; // 'closed' | 'open' | 'half-open'
```

### Поведение и ретраи

- Ретраи не выполняются в транзакциях.
- В `half-open` ретраи отключены — любая ошибка мгновенно возвращает состояние `open`.
- Счётчик неудач сбрасывается при успешном выполнении запроса.

### Логирование и метрики

Добавлен хук логгера `circuit(info)`, куда репортятся переходы состояний. В Prometheus-логгере доступны новые метрики:

- `db_circuit_transitions_total{provider,from,to}` — количество переходов состояний.
- `db_circuit_open_total{provider,reason}` — количество открытий брейкера по причинам.

Для включения Prometheus-метрик используйте пакет `@ts-linq/prometheus-sql-logger` и добавьте его в фабрику логгеров.

### Prometheus интеграция (пример)

```ts
import express from 'express';
import { SQLiteProvider } from '@ts-linq/sqlite';
import { PrometheusSqlLogger } from '@ts-linq/prometheus-sql-logger';

// 1) Создаём прометей-логгер (рекомендуется маскировать SQL)
const promLogger = new PrometheusSqlLogger('app_', { maskSql: true });

// 2) Передаём логгер провайдеру
const provider = new SQLiteProvider(':memory:', promLogger);

// 3) Экспонируем /metrics (prom-client регистрируется глобально)
const prom = require('prom-client');
const app = express();
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', prom.register.contentType);
  res.end(await prom.register.metrics());
});
app.listen(9464, () => console.log('Prometheus on :9464/metrics'));
```

Доступные метрики брейкера:

- `db_circuit_transitions_total{provider,from,to}`
- `db_circuit_open_total{provider,reason}`
- `db_circuit_state{provider}` — 0 (closed), 0.5 (half-open), 1 (open)
- `db_circuit_half_open_inflight{provider}`
- `db_circuit_failures{provider}`

Примеры простых алертов (PromQL):

```promql
sum by (provider)(db_circuit_state{provider!=""}) == 1
  # → ALERT: CircuitOpen

increase(db_circuit_open_total[5m]) > 0
  # → ALERT: FrequentCircuitOpen
```

### Быстрый чек-лист продакшена

- Таймауты клиента/драйвера:
  - Query timeout (на уровне драйвера/БД) и `DB_CONN_TIMEOUT_MS` установлены.
  - Пул: `DB_POOL_MIN/MAX`, `DB_POOL_IDLE_MS`, `DB_POOL_ACQUIRE_MS` заданы под нагрузку.
- Health-check:
  - `DB_HEALTH_ENABLED=true`, корректные `INTERVAL_MS`/`TIMEOUT_MS`.
  - `DEGRADE_AFTER`/`UNHEALTHY_AFTER` согласованы с SLO.
- Circuit Breaker:
  - `DB_CB_ENABLED=true`, `DB_CB_THRESHOLD` 5–10, `DB_CB_OPEN_MS` 15–60c, `DB_CB_MAX_OPEN_MS` 5–10м.
  - `DB_CB_HALFOPEN_MAX_CALLS` = 1–2; `DB_CB_COUNT_TRANSIENT_ONLY=true`.
  - Описан runbook для `manualReset`/`forceOpen` в инцидентах.
- Ретраи:
  - Использовать backoff стратегию; ретраи выключены в транзакциях (по умолчанию).
  - Не ретраить функциональные ошибки (констрейнты).
- Метрики/логирование:
  - Подключён `PrometheusSqlLogger`, /metrics защищён (auth/ip-list/front-proxy).
  - Дашборды: error rate, p95/99 latency, retries, circuit state/open events, health status.
- Алерты (минимум):
  - FrequentCircuitOpen, LongOpenState, ErrorRate>5%, RetrySpike, HealthDegraded.
- Нагрузочное/хаос‑тестирование:
  - Подтвердить, что брейкер открывается/закрывается ожидаемо; ретраи не ломают SLA.

### Grafana дашборд

Готовая панель лежит в `docs/grafana/ts-linq-db-dashboard.json`.

Импорт:

1. Откройте Grafana → Dashboards → Import.
2. Вставьте содержимое файла или укажите путь/URL, нажмите Import.
3. Убедитесь, что datasource Prometheus выбран корректно.

### Рекомендованные настройки для продакшена

- **enabled**: true
- **failureThreshold**: 5–10 (зависит от частоты запросов и SLA)
- **openDurationMs**: 15000–60000 (15–60 c)
- **maxOpenDurationMs**: 300000–600000 (5–10 мин) — для backoff
- **halfOpenMaxCalls**: 1–2 (чаще 1 для консервативной проверки)
- **countTransientOnly**: true (не учитывать функциональные ошибки)

Замечание: длительность `open` растёт экспоненциально до `maxOpenDurationMs` при повторных открытиях, и сбрасывается при успешном восстановлении.

### Конфигурация через ENV/CLI

Поддерживаются переменные окружения для настройки Circuit Breaker при создании провайдера через CLI-фабрику:

- `DB_CB_ENABLED=true|false`
- `DB_CB_THRESHOLD=5`
- `DB_CB_OPEN_MS=30000`
- `DB_CB_MAX_OPEN_MS=300000`
- `DB_CB_HALFOPEN_MAX_CALLS=1`
- `DB_CB_COUNT_TRANSIENT_ONLY=true|false`

Они читаются в `packages/cli/src/provider-factory.ts` и применяются через `provider.configureCircuit(...)` после инициализации.

Пример `.env` для CLI/приложения:

```dotenv
# Провайдер БД
DB_PROVIDER=postgresql
DATABASE_URL=postgres://user:pass@host:5432/db

# Пул соединений
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_MS=30000
DB_POOL_ACQUIRE_MS=10000
DB_CONN_TIMEOUT_MS=5000

# Health-check
DB_HEALTH_ENABLED=true
DB_HEALTH_INTERVAL_MS=60000
DB_HEALTH_TIMEOUT_MS=2000
DB_HEALTH_MIN_INTERVAL_MS=15000
DB_HEALTH_MAX_INTERVAL_MS=120000
DB_HEALTH_DEGRADE_AFTER=3
DB_HEALTH_UNHEALTHY_AFTER=6

# Circuit Breaker
DB_CB_ENABLED=true
DB_CB_THRESHOLD=6
DB_CB_OPEN_MS=30000
DB_CB_MAX_OPEN_MS=300000
DB_CB_HALFOPEN_MAX_CALLS=1
DB_CB_COUNT_TRANSIENT_ONLY=true
```

### Причины событий брейкера (reason)

Причины могут использоваться для алертов и диагностики:

- `failure threshold reached` — превышен порог неудач;
- `half-open probe failed` — пробный вызов в half-open завершился ошибкой;
- `cooldown elapsed` — переход в half-open после выдержки интервала;
- `health unhealthy` — открытие из-за статуса соединения unhealthy;
- `probe succeeded` — успешная проба, переход в closed;
- `manual open` / `manual reset` — ручное управление.

### Рекомендуемые SLO-алерты (PromQL)

```promql
# 1) Частые открытия брейкера за период
increase(db_circuit_open_total[5m]) > 0

# 2) Длительное нахождение в open-состоянии (по провайдеру)
max_over_time(db_circuit_state[10m]) == 1

# 3) Ошибки запросов (error rate) — пример на все операции
sum(rate(db_error_total[5m])) / sum(rate(db_query_total[5m])) > 0.05

# 4) Повышенное количество ретраев (симптом деградации)
sum(increase(db_retry_total[5m])) > 100

# 5) Деградация health-check'а
sum by (provider)(db_connection_degraded{provider!=""}) == 1
```
