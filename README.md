# ORM Framework

## Overview

This is a TypeScript ORM (Object-Relational Mapping) framework heavily inspired by Entity Framework Core. It provides a code-first approach to database management with decorator-based entity definitions, change tracking, LINQ-style querying, and a migration system. The framework follows Entity Framework's architectural patterns with a layered design that separates concerns between entity definitions, database operations, and query building.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture Pattern
The framework follows Entity Framework's architectural patterns with a layered approach:

- **Entity Layer**: Decorator-based entity definitions with metadata reflection
- **Context Layer**: DbContext manages entity sets, change tracking, and database operations  
- **Provider Layer**: Pluggable database provider architecture (currently supports SQLite)
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

- Currently implements SQLiteProvider using sqlite3 package
- Provider handles connection management, SQL generation, and query execution
- Clean separation allows adding MySQL, PostgreSQL providers later

### Query Layer (Queryable + QueryBuilder)
LINQ-style query building with method chaining is provided by `Queryable`, while SQL generation is handled by a dedicated `QueryBuilder` using a pluggable `SqlDialect`.

- `where` parses simple lambda predicates into a minimal AST (via `PredicateParser`) and generates SQL with `SqlVisitor`; for unsupported cases it falls back to in-memory filtering
- `select` projects fields
- `orderBy` / `orderByDescending` apply sorting
- `take` / `skip` add pagination
- `include` supports predicate-based eager loading; call it first in the chain (before `where/select/orderBy`) to ensure it is applied

This separation improves testability and extensibility. The AST + visitor pipeline enables SQL generation where possible, while keeping runtime semantics correct via safe fallbacks.

### Migration Framework
Code-first database evolution support:

- Abstract Migration base class for schema changes
- MigrationRunner manages migration execution order
- Up/Down methods for forward and rollback operations

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
npm install sqlite3 reflect-metadata typescript ts-node
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

### LINQ-style Queries

```ts
// Filtering, sorting, pagination
const page = await context.books
  .where(b => b.title === 'Updated')
  .orderBy(b => b.id)
  .skip(0)
  .take(10)
  .toArray();

// Aggregations and checks
const total = await context.books.count();
const any = await context.books.where(b => b.title === 'X').any();

// First/Single
const first = await context.books.orderBy(b => b.id).first();
const maybe = await context.books.where(b => b.id > 999).firstOrDefault();

// Result-based try-variants (no exceptions):
const firstRes = await context.books.orderBy(b => b.id).tryFirst();
if (firstRes.ok) { /* use firstRes.value */ } else { /* handle firstRes.error */ }
const singleRes = await context.books.where(b => b.id === 1).trySingle();
```

Include-first chaining (eager loading):
```ts
const authors = await context.authors
  .include(a => a.books)      // declare eager includes first
  .where(a => a.id === 1)
  .toArray();
```

### Eager vs Lazy Loading

By default loading is Lazy. Use `include` for eager loading:

```ts
// Eager load authors with books via predicate-based include
const authors = await context.authors.include(a => a.books).toArray();

// Depth control (context API still accepts options)
import { LoadingStrategy } from './src';
const one = await context.find(Author, 1, { strategy: LoadingStrategy.Eager, depth: 1, includes: ['books'] });
```

Note: when loading collections (e.g., one-to-many) for multiple parent rows, the loader batches queries internally to avoid the N+1 problem (uses IN clauses under the hood). Predicate-based include chaining can be combined with where/order/take.

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
  protected get name() { return 'AddAgeToUsers'; }
  protected get version() { return '002'; }
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

### Database Providers

Currently `SQLiteProvider` is implemented. A provider is responsible for:
- connecting/disconnecting
- SQL generation (DDL/DML)
- query execution
- transactions

New providers (MySQL/PostgreSQL) can be added by implementing the abstract `DatabaseProvider`.

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

### Provider Hooks

`DatabaseProvider` exposes template-method hooks around execution for cross-cutting concerns:

- `beforeExecute(sql, params)` — called before each query/non-query
- `afterExecute(sql, params, result)` — called after execution

Override these in a custom provider (or subclass) for logging, tracing, caching, metrics, etc.

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
const byId = new PredicateSpecification<Author>(a => a.id === 1, parser.parse(a => a.id === 1));
const hasName = new PredicateSpecification<Author>(a => a.name === 'Jane', parser.parse(a => a.name === 'Jane'));
const spec = Specs.and(byId, hasName);
// spec.toExpression() → AST (may be converted to SQL), spec.test(a) → boolean
```

### Typing Tips

- Prefer explicit DbSet properties in your context: `public books!: DbSet<Book>;` for better IntelliSense and types.
- Use `set(Entity)` when your property name differs from the convention or when you don't want to declare properties.

### Examples

- Simple app: `examples/simple-app.ts`
- Advanced queries: `examples/advanced-queries.ts`

### API Docs (TypeDoc)

- Generate HTML documentation:

```bash
npm run docs
```

- Output will be in the `docs/` folder. Open `docs/index.html` in a browser.
- The generator uses `src/index.ts` as the entry point and includes public and private APIs. If you see warnings about referenced types not included, consider exporting those types from `src/index.ts` or ignore the warnings.
