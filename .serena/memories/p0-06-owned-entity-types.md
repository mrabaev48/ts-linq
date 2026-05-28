# P0-06: Owned Entity Types Implementation Analysis

## Task Overview
Implement owned entity types with support for three storage strategies: table-splitting (columns prefixed on owner table), JSON storage, and separate table with composite FK (for ownsMany).

**File**: `/Users/mikhail.soosaar_1/Documents/WebsStormProjects/ts-linq/project-documents/tasks/dev-plans/P0-06-owned-entity-types.md`

**Status**: not-started  
**Priority**: P0  
**Effort**: L  
**Depends on**: P0-01 (complete)  
**Related**: P0-05, P0-15

## API Requirements (Must Mirror EF Core)
```ts
export class EntityTypeBuilder<T> {
  ownsOne<TOwned>(
    selector: (e: T) => TOwned | undefined,
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void,
  ): OwnedNavigationBuilder<T, TOwned>;

  ownsMany<TOwned>(
    selector: (e: T) => TOwned[],
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void,
  ): OwnedNavigationBuilder<T, TOwned>;
}

export class OwnedNavigationBuilder<TOwner, TOwned> {
  property<K extends keyof TOwned>(s: (e: TOwned) => TOwned[K]): PropertyBuilder<TOwned[K]>;
  withOwner(selector?: (e: TOwned) => TOwner): this;
  hasForeignKey(...props: string[]): this;
  hasKey(...props: string[]): this;
  toTable(name: string): this;
  toJson(columnName?: string): this;
}
```

## Current Codebase State

### EntityTypeBuilder.ts
- **Location**: `packages/orm/src/builders/EntityTypeBuilder.ts`
- **Current Methods**: toTable, hasKey, property, hasOne, hasMany, hasIndex, isTemporal, withHistoryTable
- **Lines**: 129 total
- **Pattern**: Stores metadata in private Maps (_columns, _relationships, _indexes), applies to registry in _applyToRegistry()

### EntityMetadata Interface
- **Location**: `packages/types/src/index.ts` lines 702-718
- **Current Fields**: target, className, tableName, columns, relationships, indexes, primaryKeys, primaryKeyColumn, schema, isTemporal, historyTableName, validationRules, validations
- **Missing**: No ownedEntities or owned-type metadata

### PropertyBuilder.ts
- **Location**: `packages/orm/src/builders/PropertyBuilder.ts`
- **Current Methods**: hasColumnName, hasColumnType, isRequired, isNullable, hasMaxLength, hasPrecision, hasDefaultValue, hasDefaultValueSql, isUnique, hasConversion (with overloads)
- **Pattern**: Maintains reference to ColumnMetadata, mutates it, returns this for chaining

### MetadataRegistry
- **Location**: `packages/metadata/src/MetadataRegistry.ts`
- **Provides**: addEntity, mergeFluentColumn, mergeFluentRelationship, setFluentPrimaryKeys, mergeFluentSchema, mergeFluentTemporal, mergeFluentIndex
- **No owned entity methods yet**

### SchemaComparator.ts
- **Location**: `packages/migrations/src/SchemaComparator.ts` (42 lines)
- **Current Logic**: diffColumns, diffIndexes, compares expected vs actual tables
- **Missing**: No logic for owned entity DDL (table splitting or JSON columns)

### Grep Results
- No existing references to ownsOne, ownsMany, ownedEntities, OwnedEntity in codebase

## New Artifacts Required

### 1. StorageStrategy Enum
```ts
// packages/metadata/src/StorageStrategy.ts
export enum StorageStrategy {
  TableSplit = 'TableSplit',      // columns prefixed on owner table
  SeparateTable = 'SeparateTable', // ownsMany: separate table with composite FK
  Json = 'Json'                    // single JSON column
}
```

### 2. OwnedEntityMetadata Interface
```ts
// packages/metadata/src/OwnedEntityMetadata.ts
export interface OwnedEntityMetadata {
  ownerPropertyName: string;      // e.g., "address" in Order.address
  ownedEntityType: Function;       // the owned class
  storageStrategy: StorageStrategy;
  jsonColumnName?: string;         // for Json strategy
  ownerClass: Function;            // back-reference to owner
  columns: ColumnMetadata[];       // for TableSplit: prefixed columns
  foreignKeyPropertyName?: string; // for SeparateTable
  ownedNavigations?: OwnedEntityMetadata[]; // nested ownership
  isCollection?: boolean;          // ownsMany vs ownsOne
}
```

### 3. OwnedNavigationBuilder
```ts
// packages/orm/src/builders/OwnedNavigationBuilder.ts
export class OwnedNavigationBuilder<TOwner, TOwned> {
  private _metadata: Partial<OwnedEntityMetadata>;
  
  property<K extends keyof TOwned>(s: (e: TOwned) => TOwned[K]): PropertyBuilder<TOwned[K]>;
  withOwner(selector?: (e: TOwned) => TOwner): this;
  hasForeignKey(...props: string[]): this;
  hasKey(...props: string[]): this;
  toTable(name: string): this;    // table splitting
  toJson(columnName?: string): this; // JSON storage
}
```

### 4. Updated EntityMetadata Interface
Add to `packages/types/src/index.ts`:
```ts
export interface EntityMetadata {
  // ...existing fields...
  ownedEntities?: OwnedEntityMetadata[]; // array of owned children
}
```

### 5. MetadataRegistry Extensions
Add methods to `packages/metadata/src/MetadataRegistry.ts`:
```ts
addOwnedEntity(ownerCtor: Function, ownedMetadata: OwnedEntityMetadata): void;
getOwnedEntities(entityCtor: Function): OwnedEntityMetadata[];
```

## Key Implementation Points

### EntityTypeBuilder Changes
- Add ownsOne<TOwned>() and ownsMany<TOwned>() methods
- Return OwnedNavigationBuilder instance
- Store OwnedEntityMetadata in private array
- Apply to registry in _applyToRegistry()

### Metadata Finalization
- At metadata finalize time, collapse OwnedEntityMetadata into owner's column list (for TableSplit)
- Register as JSON column for Json strategy
- Create separate table metadata for SeparateTable strategy

### Query Translation (SelectVisitor)
- Flatten owned columns in projection for TableSplit
- Handle JSON path extraction for Json strategy
- Owned navigations always eager-loaded (no Include needed)

### Schema DDL (SchemaComparator, MigrationBuilder)
- TableSplit: emit owner-table columns with prefix (e.g., "Address_Street")
- Json: single JSON column on owner table
- SeparateTable: separate table with composite PK (e.g., InvoiceId, ItemIdx)

### Materialization
- Rebuild owned graph from flat columns or parsed JSON
- Match logic to storage strategy

## Acceptance Criteria
- [ ] Public API mirrors EF Core signature
- [ ] Table-splitting emits prefixed columns on owner's table (DDL test)
- [ ] ToJson() stores the graph in a single JSON column
- [ ] Materialization rebuilds nested instance correctly for both strategies
- [ ] ownsMany correctly persists collections (separate table with composite key)
- [ ] No regressions in typecheck, arch:deps, arch:cycles, arch:dead

## No Existing Code Found
- grep search found ZERO references to ownsOne, ownsMany, ownedEntities, OwnedEntity
- This is a greenfield implementation on top of P0-01 (ModelBuilder - complete)
