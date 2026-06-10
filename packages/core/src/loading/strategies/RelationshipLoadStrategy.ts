import type { EntityMetadata, MetadataSource } from '@ts-linq/types';

import type { DatabaseProvider } from '../../DatabaseProvider';
import type { EntityGrouper } from '../support/EntityGrouper';
import type { ForeignKeyConvention } from '../support/ForeignKeyConvention';
import type { InClauseChunker } from '../support/InClauseChunker';
import type { LoadableRelationship } from '../support/LoadableRelationship';
import type { TargetEntityResolver } from '../support/TargetEntityResolver';

/**
 * Per-call collaborators + behavioural hooks supplied to a
 * {@link RelationshipLoadStrategy}. It is the single seam that keeps the two
 * orchestrators split while letting them share one strategy implementation:
 *
 * - `EntityLoader` (eager) supplies identity proxy hooks, a no-op `markLoaded`,
 *   a real `assignSingle`, a recursive `fetchToOne`/`recurseBatched`, and an
 *   `undefined` `absentToMany`.
 * - `RelationshipLoader` (lazy/proxy) supplies real `wrapOne`/`wrapMany`/
 *   `rawTarget`/`markLoaded`, a no-op `assignSingle` (it returns instead), a
 *   non-recursive `fetchToOne`/`recurseBatched`, and an `[]` `absentToMany`.
 *
 * Every observable behavioural difference between the loaders is captured here,
 * so the strategy bodies are behaviour-preserving for both callers.
 */
export interface RelationshipLoadContext {
  readonly provider: DatabaseProvider;
  readonly metadata: MetadataSource;
  readonly foreignKeys: ForeignKeyConvention;
  readonly targetResolver: TargetEntityResolver;
  readonly chunker: InClauseChunker;
  readonly grouper: EntityGrouper;
  /** IN()-list chunk size used by the shared chunker. */
  readonly chunkSize: number;

  /** Wrap a single related entity (identity for eager loads). */
  wrapOne(entity: object, ctor: new () => object): object;
  /** Wrap a related collection (identity for eager loads). */
  wrapMany(entities: object[], ctor: new () => object): object[];
  /** Unwrap a possibly-proxied entity to its raw target (identity for eager). */
  rawTarget(entity: unknown): unknown;
  /** Mark a navigation as loaded on the entity's lazy state (no-op for eager). */
  markLoaded(entity: unknown, propertyName: string): void;

  /** Assign a navigation on the entity during single loads (no-op for proxy). */
  assignSingle(entity: unknown, propertyName: string, value: unknown): void;
  /** Fetch one related entity by id — recursive `loadEntity` (eager) or
   *  `findById` + `wrapOne` (proxy). Returns `null` when absent. */
  fetchToOne(ctor: new () => object, id: unknown): Promise<unknown>;
  /** Value returned by single to-many loads when the source key is absent:
   *  `undefined` for eager (leave the property untouched) or `[]` for proxy. */
  readonly absentToMany: unknown;
  /** Map a batched to-one lookup result before assignment: identity for eager
   *  (`undefined` when missing) or `?? null` for proxy. */
  resolveBatchedToOne(value: unknown): unknown;
  /** Continue eager depth recursion over freshly loaded targets (no-op for proxy). */
  recurseBatched(related: unknown[], ctor: new () => object): Promise<void>;
}

/**
 * Strategy for loading one relationship kind, in both the single-entity and the
 * batched (N+1-avoiding) shapes. One instance is registered per
 * `relationship.type` in {@link relationshipStrategyRegistry}.
 */
export interface RelationshipLoadStrategy {
  /**
   * Load the relationship for a single source entity. Returns the loaded value
   * (used by the proxy loader); the eager loader assigns via
   * {@link RelationshipLoadContext.assignSingle} and ignores the return.
   */
  loadSingle(
    ctx: RelationshipLoadContext,
    entity: unknown,
    sourceCtor: new () => object,
    sourceMeta: EntityMetadata,
    relationship: LoadableRelationship
  ): Promise<unknown>;

  /** Load the relationship for many source entities, assigning each in place. */
  loadBatch(
    ctx: RelationshipLoadContext,
    entities: unknown[],
    sourceCtor: new () => object,
    sourceMeta: EntityMetadata,
    relationship: LoadableRelationship
  ): Promise<void>;
}
