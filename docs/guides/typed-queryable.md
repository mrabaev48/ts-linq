# TypedQueryable - Compile-Time Type Safety

## Overview

`TypedQueryable<T>` is a type-safe wrapper around `Queryable<T>` that provides **compile-time validation** for all query operations. It catches errors during development instead of at runtime.

## Why TypedQueryable?

### Problem with Regular Queryable

```typescript
// Regular Queryable - compiles fine, fails at runtime
const users = await ctx.users
  .select(u => ({ invalid: u.nonExistent }))  // ✅ Compiles
  .toArray();  // 💥 Runtime error: nonExistent is undefined
```

### Solution with TypedQueryable

```typescript
import { typed } from '@ts-linq/query';

// TypedQueryable - compile error catches the mistake
const users = await typed(ctx.users)
  .select(u => ({ invalid: u.nonExistent }))  // ❌ COMPILE ERROR!
  .toArray();
```

## Key Features

### 1. Type-Safe Select

Only allows selecting properties that actually exist on the entity:

```typescript
@Entity()
class User {
  @PrimaryKey()
  id!: number;
  
  @Column()
  name!: string;
  
  @Column()
  email!: string;
}

// ✅ Valid - existing properties
typed(ctx.users).select(u => ({ 
  id: u.id, 
  name: u.name 
}));

// ❌ Compile error - 'age' doesn't exist on User
typed(ctx.users).select(u => ({ 
  age: u.age  // Property 'age' does not exist on type 'User'
}));
```

### 2. Type-Safe Where

Predicates are fully typed:

```typescript
// ✅ Valid
typed(ctx.users).where(u => u.name === 'John');
typed(ctx.users).where(u => u.id > 100);

// ❌ Compile error
typed(ctx.users).where(u => u.nonExistent === 'value');
```

### 3. Type-Safe Include (Relationships Only)

Only allows including actual relationship properties:

```typescript
@Entity()
class User {
  @PrimaryKey()
  id!: number;
  
  @Column()
  name!: string;
  
  @OneToMany(() => Order, order => order.user)
  orders!: Order[];
}

// ✅ Valid - 'orders' is a relationship
typed(ctx.users).include(u => u.orders);

// ❌ Compile error - 'name' is not a relationship
typed(ctx.users).include(u => u.name);
```

The type system automatically detects relationships:
- Arrays: `Order[]` ✅
- Objects (excluding Date/Function): `Profile` ✅  
- Primitives: `string`, `number` ❌
- Dates: `Date` ❌

### 4. Type-Safe OrderBy

```typescript
// ✅ Valid
typed(ctx.users).orderBy(u => u.name, 'ASC');
typed(ctx.users).orderBy(u => u.createdAt, 'DESC');

// ❌ Compile error - invalid property
typed(ctx.users).orderBy(u => u.nonExistent);
```

### 5. Entity Framework-Style API

TypedQueryable includes Entity Framework-compatible methods:

```typescript
// Aggregations
const avgSalary = await typed(ctx.employees).average(e => e.salary);
const totalAmount = await typed(ctx.orders).sum(o => o.amount);
const youngest = await typed(ctx.users).min(u => u.age);
const oldest = await typed(ctx.users).max(u => u.age);

// Set operations
const activeUsers = typed(ctx.users).where(u => u.isActive);
const premiumUsers = typed(ctx.users).where(u => u.isPremium);

const activePremium = activeUsers.intersect(premiumUsers);
const activeOnly = activeUsers.except(premiumUsers);
const allSpecial = activeUsers.concat(premiumUsers);
```

## Usage

### Basic Usage

```typescript
import { typed } from '@ts-linq/query';

// Wrap any Queryable with typed()
const query = typed(ctx.users)
  .where(u => u.age >= 18)
  .select(u => ({ id: u.id, name: u.name }))
  .orderBy(u => u.name);

const results = await query.toArray();
```

### With DbSet

```typescript
class AppDbContext extends DbContext {
  users!: DbSet<User>;
  
  // Helper method for typed queries
  typedUsers(): TypedQueryable<User> {
    return typed(this.users);
  }
}

// Usage
const ctx = new AppDbContext();
const adults = await ctx.typedUsers()
  .where(u => u.age >= 18)
  .toArray();
```

### Complex Queries

```typescript
// Type-safe complex query
const result = await typed(ctx.users)
  .where(u => u.isActive)
  .include(u => u.orders)
  .include(u => u.profile)
  .select(u => ({
    user: u.name,
    orderCount: u.orders.length,
    profileComplete: u.profile !== null
  }))
  .orderBy(r => r.orderCount, 'DESC')
  .take(10)
  .toArray();
```

## Performance

TypedQueryable has **zero runtime overhead** - it's a compile-time only wrapper:

1. All type checking happens during compilation
2. At runtime, TypedQueryable delegates directly to Queryable
3. No performance difference between `typed(query)` and `query`

## When to Use

### ✅ Use TypedQueryable when:

- Building production applications where bugs are costly
- Working in large teams where type safety prevents mistakes
- Refactoring queries and want compile-time verification
- Using Entity Framework-style API (`.except()`, `.intersect()`)

### ⚠️ Use Regular Queryable when:

- Prototyping or writing throwaway code
- Need dynamic queries that can't be typed
- Performance profiling (to eliminate TypeScript overhead)
- Accessing the `.raw` queryable

## Migration from Regular Queryable

Migration is simple - just wrap with `typed()`:

```typescript
// Before
const users = await ctx.users
  .where(u => u.age >= 18)
  .toArray();

// After
const users = await typed(ctx.users)
  .where(u => u.age >= 18)
  .toArray();
```

## API Reference

### Construction

```typescript
// Static factory
TypedQueryable.from<T>(queryable: Queryable<T>): TypedQueryable<T>

// Helper function
typed<T>(queryable: Queryable<T>): TypedQueryable<T>
```

### Query Building

```typescript
.select<TResult>(selector: (entity: T) => TResult): TypedQueryable<TResult>
.where(predicate: (entity: T) => boolean): TypedQueryable<T>
.orderBy<K>(selector: (entity: T) => T[K], direction?: 'ASC' | 'DESC'): TypedQueryable<T>
.include<TProp>(navigation: (entity: T) => TProp): TypedQueryable<T>
.take(count: number): TypedQueryable<T>
.skip(count: number): TypedQueryable<T>
.distinct(): TypedQueryable<T>
.thenBy<K>(selector: (entity: T) => T[K]): TypedQueryable<T>
.thenByDescending<K>(selector: (entity: T) => T[K]): TypedQueryable<T>
```

### Execution

```typescript
.toArray(): Promise<T[]>
.first(): Promise<T>
.firstOrDefault(): Promise<T | null>
.single(): Promise<T>
.count(): Promise<number>
.any(): Promise<boolean>
.all(predicate: (entity: T) => boolean): Promise<boolean>
```

### Aggregations (EF-style)

```typescript
.average<K>(selector: (entity: T) => T[K]): Promise<number>
.sum<K>(selector: (entity: T) => T[K]): Promise<number>
.min<K>(selector: (entity: T) => T[K]): Promise<T[K]>
.max<K>(selector: (entity: T) => T[K]): Promise<T[K]>
.contains(item: T): Promise<boolean>
```

### Set Operations (EF-style)

```typescript
.except(other: TypedQueryable<T>): TypedQueryable<T>
.intersect(other: TypedQueryable<T>): TypedQueryable<T>
.concat(other: TypedQueryable<T>): TypedQueryable<T>
```

### Pagination

```typescript
.paginate(page: number, size: number): Promise<{
  items: T[];
  total: number;
  page: number;
  size: number;
}>

.keysetPaginate<K>(
  key: K,
  after: T[K] | null,
  size: number
): Promise<{
  items: T[];
  pageSize: number;
  nextAfter: T[K] | null;
}>
```

### Advanced

```typescript
.withAbort(signal: AbortSignal): TypedQueryable<T>
.raw: Queryable<T>  // Access underlying Queryable (bypasses type safety)
```

## Examples

See the [examples directory](../../packages/examples/src/) for more comprehensive examples.

## Best Practices

1. **Use typed() by default** in production code
2. **Create helper methods** on DbContext for commonly used typed queries
3. **Leverage IntelliSense** - let your IDE show you available properties
4. **Catch errors early** - compile-time errors are cheaper than runtime errors
5. **Document custom types** when using complex `.select()` projections

## Troubleshooting

### "Type instantiation is excessively deep and possibly infinite"

This can happen with very complex nested queries. Solutions:
- Break the query into smaller parts
- Use intermediate variables
- Simplify the projection in `.select()`

### "Cannot find name 'typed'"

Make sure you're importing from the correct package:
```typescript
import { typed } from '@ts-linq/query';
```

### Relationship not detected by `.include()`

Ensure your relationship property is properly typed:
```typescript
// ✅ Correct
@OneToMany(() => Order, order => order.user)
orders!: Order[];

// ❌ Wrong - not typed
orders: any;
```
