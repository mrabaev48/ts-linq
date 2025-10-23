# Test Status - Vitest Migration with Real Decorators

**Last Updated:** October 23, 2025

## Current Status: 21/44 core tests passing (48%)

### Vitest Migration Complete ✅
- ✅ Migrated from Jest to Vitest
- ✅ Native Stage-3 decorator support via unplugin-swc
- ✅ Tests use **real decorators** (@Entity, @Column, @PrimaryKey, @Index, @ManyToOne, @OneToMany)
- ✅ Performance: ~1.56s (2.5x faster than Jest ~4s)

## Test Results

### packages/core/tests/dbcontext.test.ts
**Status:** 16/26 tests passing (62%)

#### ✅ Passing (16)
- Initialization and Setup (3/3)
  - should create DbContext instance
  - ensureCreated should initialize database tables  
  - should dispose context properly
- DbSet Access (4/4)
  - should return DbSet for registered entity
  - should return DbSet for multiple entities
  - should throw for unregistered entity
  - should cache DbSet instances
- CRUD Operations (2/5)
  - should persist added entities
  - should delete removed entities
- Transactions (2/2)
  - should handle empty saveChanges
  - should allow multiple consecutive saveChanges
- Query Operations (3/6)
  - should query all entities
  - should return null for non-existent ID
  - should count entities
  - should get first entity
- Edge Cases (2/2)
  - should handle nullable columns
  - should handle entity with all required fields

#### ❌ Failing (10)
- **Batch operations**: Multiple entities don't get auto-increment IDs
- **Update operations**: Find after update fails
- **Mixed operations**: Complex batch scenarios fail
- **Entity tracking**: Can't access ChangeTracker._states (private)
- **Query filtering**: Where clause not fully implemented in stub

### packages/core/tests/metadata/MetadataStorage.test.ts
**Status:** 5/18 tests passing (28%)

#### ✅ Passing (5)
- Entity Registration (2/3)
  - should register entity with @Entity decorator
  - should register multiple entities
- Metadata Retrieval (2/2)
  - should get all registered entities
  - should return undefined for unregistered entity
- Metadata Clear (1/1)
  - should clear all metadata

#### ❌ Failing (13)
- **Custom table name**: @Entity({ tableName: 'custom' }) not applied
- **Column metadata**: Column options not captured (nullable, defaultValue, columnName)
- **Primary keys**: PK metadata not fully captured
- **Indexes**: @Index decorator not working correctly
- **Relationships**: @ManyToOne/@OneToMany not registering metadata

## Known Issues

### 1. Decorator Metadata Capture
**Problem:** Some decorator options not being captured by MetadataStorage
- Custom table names ignored
- Column options (nullable, defaultValue, columnName) not saved
- Relationship metadata missing

**Root Cause:** Decorators may not be invoking MetadataStorage.add* methods correctly

### 2. ProviderStub Batch Operations
**Problem:** Multiple inserts don't return auto-increment IDs
```typescript
// After batch insert, IDs are undefined:
context.set(User).add(user1);
context.set(User).add(user2);
await context.saveChanges(); // Returns 2 (correct)
user1.id; // undefined (wrong!)
user2.id; // undefined (wrong!)
```

**Fix Needed:** ProviderStub needs to handle batch inserts properly

### 3. Index Decorator Import
**Problem:** @Index from '@ts-linq/core/decorators' may not match expected signature

**Fix Needed:** Verify Index decorator signature: `@Index(name, columns, options)`

### 4. Private Property Access in Tests
**Problem:** Tests try to access `context._changeTracker.getState()` but _changeTracker is private

**Fix Needed:** Add public accessor or redesign tests

## Migration Progress

### Completed ✅
1. Vitest installation and configuration
2. SWC plugin for Stage-3 decorators (decoratorVersion: '2022-03')
3. Rewritten DbContext integration tests (22 tests)
4. Rewritten MetadataStorage tests (18 tests)
5. Updated ProviderStub imports to use @ts-linq/* packages
6. Created TestProvider stub for ORM tests

### In Progress 🚧
1. Fixing decorator metadata capture issues
2. Improving ProviderStub for batch operations
3. Making private properties accessible for testing

### Pending 📋
1. Rewrite remaining core tests (loading, migrations, cache, etc.)
2. Rewrite query/TypedQueryable tests
3. Rewrite provider tests (SQLite, Postgres, MySQL, MSSQL)
4. Rewrite E2E tests with real decorators
5. Add comprehensive relationship tests
6. Add validation tests with @ValidIf decorator

## Test File Status

### Core Tests
- ✅ packages/core/tests/dbcontext.test.ts (16/26 passing)
- ✅ packages/core/tests/metadata/MetadataStorage.test.ts (5/18 passing)
- ⏳ packages/core/tests/decorators/*.test.ts (not yet updated)
- ⏳ packages/core/tests/context/*.test.ts (not yet updated)
- ⏳ packages/core/tests/loading/*.test.ts (not yet updated)
- ⏳ packages/core/tests/migrations/*.test.ts (not yet updated)
- ⏳ packages/core/tests/cache/*.test.ts (not yet updated)

### ORM Tests
- ✅ packages/orm/tests/integration/DbContext.CRUD.test.ts (6/22 passing)
- ⏳ Other ORM tests need migration

### Provider Tests
- ⏳ SQLite provider tests (30+ files)
- ⏳ Postgres provider tests (20+ files)
- ⏳ MySQL provider tests (10+ files)
- ⏳ MSSQL provider tests (20+ files)

### CLI Tests
- ⏳ CLI tests likely need minimal changes
- ⏳ Config tests may work as-is

## Next Steps

1. **Fix decorator metadata** - Ensure all decorator options are captured
2. **Improve ProviderStub** - Handle batch inserts, updates correctly
3. **Add public test APIs** - Expose ChangeTracker state for tests
4. **Migrate decorator tests** - Rewrite with real Stage-3 decorators
5. **Run full test suite** - Verify all 232 test files work with Vitest
