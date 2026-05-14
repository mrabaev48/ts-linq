# ISSUE-011: Pervasive `as unknown as` Casts in Production Query Code

## Severity

Medium

## Category

- Type System
- Maintainability
- Clean Code

## Location

- `packages/query/src/Queryable.ts` — lines 198, 335, 351, 363, 391, 399–400, 603, 610, 887, 900, 912
- `packages/query/src/QueryExecutor.ts` — lines 50, 65, 167, 210, 215, 357, 398
- `packages/query/src/QueryBuilder.ts` — lines 58, 232
- `packages/query/src/TypedQueryable.ts` — lines 70, 190, 208, 221 (see also ISSUE-004)
- `packages/query/src/RowMaterializer.ts` — lines 75, 122
- `packages/query/src/AggregateOperations.ts` — line 79

## Problem

The query package contains over 25 `as unknown as X` casts in production source code. While individual casts may be locally justified, the sheer density indicates a systemic type design problem — the internal interfaces between query-building classes do not align with their actual runtime contracts.

Categories of casts found:

### 1. Generic type parameter mismatches
```typescript
// Queryable.ts:391
this._entityClass as unknown as new () => TResult
// When select() changes T, the entity class type no longer matches
```

### 2. Internal state access across class boundaries
```typescript
// Queryable.ts:399–400
(next as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks = [
  ...((this as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks || [])
]
// Accessing a private field across a type boundary
```

### 3. Row data coercions
```typescript
// QueryExecutor.ts:65
(winner.rows as unknown as T[]).slice()
// QueryExecutor.ts:210
return { rows: data as unknown as ReadonlyArray<unknown>, label: fb.label };
// RowMaterializer.ts:75
(entity as unknown as Record<string, unknown>)[column.propertyName] = ...
```

### 4. Provider method existence checks
```typescript
// RowMaterializer.ts:122
this.provider as unknown as { notifyEntityMaterialized?: (e: T, m?: unknown) => void }
// Duck-typing an optional provider extension point
```

### 5. Parameter type coercions
```typescript
// Queryable.ts:198
parameters: values as unknown as SqlParameter[]
// Queryable.ts:603
parameters: [after as unknown as SqlParameter]
```

## Why It Matters

- **Type-safety risk**: Each cast is a point where compiler guarantees are suspended. Runtime type errors in these areas produce opaque failures without TypeScript's usual diagnostics.
- **Maintainability**: When a type signature changes (e.g., `SqlParameter` becomes a discriminated union), every cast site must be manually updated — the compiler will not catch mismatches.
- **Hidden contracts**: The casts reveal undocumented contracts between classes (e.g., that `_fallbacks` is a specific array type, that rows are `T[]`). These contracts cannot be expressed or enforced by the type system.
- **Code review risk**: Each `as unknown as` requires careful human review to verify correctness. As the codebase grows, this review burden accumulates.

## Recommended Fix

Address each category:

1. **Generic mismatches**: Define proper generic bounds on `Queryable<T>` or split the class at type-change boundaries (see ISSUE-001). Use overloads or `Queryable<TResult>` factory methods.

2. **Private field access**: Move cross-cutting state (like `_fallbacks`) to a shared context object passed explicitly, or extract it into a dedicated class (see ISSUE-001).

3. **Row data coercions**: Define a `RawRow = Record<string, unknown>` type and use it consistently. Provide typed materializer interfaces rather than coercing raw data.

4. **Provider extension points**: Move optional provider extensions into the `DatabaseProvider` interface as optional methods, or use an explicit capabilities pattern:
   ```typescript
   interface EntityMaterializationCapable {
     notifyEntityMaterialized<T>(entity: T): void;
   }
   function hasEntityMaterialization(p: unknown): p is EntityMaterializationCapable { ... }
   ```

5. **Parameter coercions**: The `SqlParameter` type should be flexible enough to accept typed values without casting. If `T[K]` is not assignable to `SqlParameter`, extend the `SqlParameter` union type.

## Acceptance Criteria

- `as unknown as` count in `packages/query/src/` production files drops from 25+ to under 5
- All remaining casts have a code comment explaining why they are necessary
- New TypeScript interfaces document the contracts that were previously implicit in casts
- No new `as unknown as` casts are introduced in PR reviews without explicit justification
