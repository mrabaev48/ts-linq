// Runtime enums for the ORM model.
//
// This module is the single home for every value-emitting `enum` in the package.
// Each enum is a regular (non-`const`) string enum: consumers across the monorepo
// rely on the runtime objects (member access, `switch`, default parameters), and
// cross-package `const enum` inlining is unsafe here (separate per-package builds,
// `preserveConstEnums`/`isolatedModules` unset). This module has no dependencies.

/** Entity state for change tracking. */
export enum EntityState {
  Unchanged = 'unchanged',
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted'
}

/** Relationship loading strategy. */
export enum LoadingStrategy {
  Lazy = 'lazy',
  Eager = 'eager',
  Explicit = 'explicit'
}

/** When a value-generated property is populated (mirrors EF Core's ValueGenerated). */
export enum ValueGeneratedPolicy {
  Never = 'Never',
  OnAdd = 'OnAdd',
  OnUpdate = 'OnUpdate',
  OnAddOrUpdate = 'OnAddOrUpdate'
}

/** Referential action applied to a relationship on delete. */
export enum DeleteBehavior {
  Cascade = 'Cascade',
  Restrict = 'Restrict',
  SetNull = 'SetNull',
  ClientSetNull = 'ClientSetNull',
  NoAction = 'NoAction',
  ClientCascade = 'ClientCascade',
  ClientNoAction = 'ClientNoAction'
}

/** Physical storage strategy for an owned entity type. */
export enum StorageStrategy {
  TableSplit = 'TableSplit',
  SeparateTable = 'SeparateTable',
  Json = 'Json'
}

/** Inheritance mapping strategy (table-per-hierarchy/type/concrete). */
export enum InheritanceStrategy {
  Tph = 'Tph',
  Tpt = 'Tpt',
  Tpc = 'Tpc'
}

/**
 * Controls whether queries with collection Includes are executed as a single
 * SQL statement with JOINs (SingleQuery) or as a series of separate statements
 * (SplitQuery). Mirrors EF Core's QuerySplittingBehavior.
 *
 * ## SplitQuery (recommended default)
 * Each Include path that targets a collection navigation is loaded via a
 * separate batched IN-query against the database, preventing cartesian-product
 * row explosion at the cost of additional round trips.
 *
 * ## SingleQuery
 * All data is retrieved in a single SQL statement. For queries with multiple
 * collection Includes this can produce cartesian explosion (N × M rows).
 * Prefer this mode only when the result set is known to be small.
 *
 * > **Warning (mirrors EF Core):** Split queries are not transactionally
 * > consistent unless the caller wraps the operation in an explicit transaction.
 */
export enum QuerySplittingBehavior {
  /** One SQL SELECT per collection Include path. Avoids cartesian explosion. */
  SplitQuery = 'SplitQuery',
  /** Single SQL SELECT with JOINs for all Includes. May cause cartesian explosion. */
  SingleQuery = 'SingleQuery'
}
