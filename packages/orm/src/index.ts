// @public — the supported public API of `@ts-linq/orm`.
//
// Implementation-only collaborators (batch executor/grouper, identity map, interceptor
// registry, cascade walker, JSON snapshotter, pending-model-changes probe, value-generator
// *classes*) are intentionally NOT re-exported here; they live behind the opt-in
// `@ts-linq/orm/internal` subpath. The `OrmPublicBarrel` test gates this surface so internals
// cannot silently re-leak from `"."`.
export * from './builders';
/** @public Advanced model-builder for database sequences (HiLo / server-side sequences). */
export { SequenceBuilder } from './builders/SequenceBuilder';
export * from './ChangeTracker';
/** @public Change-tracking entry for a single tracked entity (state, original/current values). */
export { EntityEntry } from './changetracker/EntityEntry';
/** @public Graph-node view of an {@link EntityEntry} used by `trackGraph`/cascade traversal. */
export type { EntityEntryGraphNode } from './changetracker/EntityEntryGraphNode';
/** @public Change-tracking entry for a single property of a tracked entity. */
export { PropertyEntry } from './changetracker/PropertyEntry';
export * from './DatabaseFacade';
export * from './DbContext';
export * from './DbContextOptionsBuilder';
export * from './DbSet';
export { DbUpdateConcurrencyException } from './exceptions/DbUpdateConcurrencyException';
export { KeylessMutationError } from './exceptions/KeylessMutationError';
export * from './factory';
export * from './factory/DbContextFactory';
export * from './factory/IDbContextFactory';
export * from './lifecycle/resetContext';
/** @public Observable local-view change notifications (see {@link LocalView}). */
export type { LocalViewChange, LocalViewChangeType, LocalViewListener } from './LocalView';
/** @public Observable in-memory view of tracked entities of a given type (`DbSet.local`). */
export { LocalView } from './LocalView';
export * from './ModelBuilder';
export * from './options/configure-warnings';
export * from './options/enable-sensitive-data-logging';
export * from './options/log-to';
export * from './pooling/DbContextPool';
export * from './pooling/PooledDbContextFactory';
/** @public Tagged-template `sql\`…\`` builder and its `SqlInterpolated` result for raw SQL seeds. */
export { sql, SqlInterpolated } from './sql/sqlTag';
export * from './transactions/DbContextTransaction';
// Callback type users implement to feed a HiLo value generator. The concrete
// `HiLoValueGenerator` class is internal (see `@ts-linq/orm/internal`); this type stays public
// so consumers can type their block-fetch function without depending on the implementation.
export type { FetchNextHiLoBlock } from './valueGenerators/HiLoValueGenerator';
// Catchable base classes for the errors orm throws — re-exported from the canonical
// `@ts-linq/types` hierarchy so consumers can branch on them without a second import.
export { DbUpdateException, OrmConfigurationError } from '@ts-linq/types';
