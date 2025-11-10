# Legacy Tests (Archived)

## Status: DISABLED - Incompatible with Current Package Structure

These tests were written for the **pre-refactoring monolithic structure** where all modules lived in a single `@ts-linq/core` package.

## Why Disabled?

The codebase has been refactored into a **multi-package monorepo**:

- `DbContext`, `DbSet`, `ChangeTracker` → **@ts-linq/orm**
- `Queryable`, `QueryBuilder`, `SqlDialect` → **@ts-linq/query**  
- `MetadataStorage` → **@ts-linq/metadata**
- Core utilities remain in **@ts-linq/core**

**These tests use old import paths** like:
```typescript
import { DbContext } from '../src/context/DbContext';  // ❌ No longer exists
import { Queryable } from '../src/query/Queryable';     // ❌ No longer exists
```

## Correct Imports (New Structure)

```typescript
import { DbContext, DbSet } from '@ts-linq/orm';
import { Queryable, QueryBuilder } from '@ts-linq/query';
import { MetadataStorage } from '@ts-linq/metadata';
import { EntityLoader, SqlHelper } from '@ts-linq/core';
```

## What to Do?

**For reference only.** Valuable test cases will be migrated to the correct packages:
- DbContext/DbSet tests → `packages/orm/tests-new/`
- Queryable tests → `packages/query/tests-new/`
- Migration tests → `packages/migrations/tests-new/`

## Current Test Coverage

**New tests written from scratch** in correct locations:
- ✅ `packages/core/tests-new/` - 125 tests (utilities, loading)
- ✅ `packages/metadata/tests/` - 52 tests (decorators, metadata)
- 🚧 Tier 1 in progress: query, orm, migrations packages

**Total:** 505+ tests passing with modern architecture.
