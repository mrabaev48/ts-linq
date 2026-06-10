import type { MetadataSource, RelationshipMetadata } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import { getDefaultMetadataSource } from '../defaultMetadataSource';
import { type LazyLoadingState, markLoaded } from './LazyLoadingState';
import { LAZY_LOADING_STATE, LAZY_LOADING_TARGET } from './LazyLoadingSymbols';
import type { RelationshipLoadContext } from './strategies/RelationshipLoadStrategy';
import { strategyFor } from './strategies/relationshipStrategyRegistry';
import { EntityGrouper } from './support/EntityGrouper';
import { ForeignKeyConvention } from './support/ForeignKeyConvention';
import { DEFAULT_IN_CHUNK_SIZE, InClauseChunker } from './support/InClauseChunker';
import { asLoadable } from './support/LoadableRelationship';
import { TargetEntityResolver } from './support/TargetEntityResolver';

export type ProxyWrapOne = <T extends object>(
  entity: T,
  ctor: new () => T,
  provider: DatabaseProvider
) => T;

export type ProxyWrapMany = <T extends object>(
  entities: T[],
  ctor: new () => T,
  provider: DatabaseProvider
) => T[];

/**
 * Proxy-aware relationship loader used by the lazy-loading proxies. It shares
 * the per-kind loading mechanics with {@link EntityLoader} via the
 * {@link strategyFor strategy registry}; the only differences — proxy wrapping,
 * `markLoaded` state tracking, no depth recursion — are supplied through its
 * {@link RelationshipLoadContext}. Junction reads gain IN()-chunking for free
 * from the shared {@link InClauseChunker}.
 */
export class RelationshipLoader {
  private readonly _foreignKeys = new ForeignKeyConvention();
  private readonly _targetResolver = new TargetEntityResolver();
  private readonly _chunker = new InClauseChunker();
  private readonly _grouper = new EntityGrouper();
  private _context?: RelationshipLoadContext;

  /**
   * @param metadata Metadata source the loader resolves entity metadata from.
   *   Defaults to the global singleton for backward compatibility; callers
   *   should inject the per-context registry to preserve multi-tenant isolation.
   *
   * @deprecated Relying on the implicit global-singleton default defeats
   *   per-context isolation — always inject an explicit `MetadataSource`.
   */
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly wrapOne: ProxyWrapOne,
    private readonly wrapMany: ProxyWrapMany,
    private readonly _metadata: MetadataSource = getDefaultMetadataSource()
  ) {}

  async loadSingle<T>(
    entity: T,
    entityClass: new () => T,
    relationship: RelationshipMetadata
  ): Promise<unknown> {
    const metadata = this._metadata.getEntity(entityClass);
    if (!metadata) return null;
    const loadable = asLoadable(relationship);
    if (!loadable) return null;
    const strategy = strategyFor(loadable.type);
    if (!strategy) return null;
    return strategy.loadSingle(
      this.context(),
      entity,
      entityClass as new () => object,
      metadata,
      loadable
    );
  }

  async loadBatch<T>(
    entities: T[],
    entityClass: new () => T,
    relationship: RelationshipMetadata
  ): Promise<void> {
    if (entities.length === 0) return;
    const metadata = this._metadata.getEntity(entityClass);
    if (!metadata) return;
    const loadable = asLoadable(relationship);
    if (!loadable) return;
    const strategy = strategyFor(loadable.type);
    if (!strategy) return;
    await strategy.loadBatch(
      this.context(),
      entities,
      entityClass as new () => object,
      metadata,
      loadable
    );
  }

  /**
   * Build (once) the proxy-loading context for the strategy registry: real
   * proxy wrapping, `markLoaded` state tracking, a `findById` + `wrapOne`
   * `fetchToOne`, an `[]` `absentToMany`, a `?? null` batched to-one policy,
   * and no depth recursion — preserving the historical proxy behaviour while
   * inheriting IN()-chunking from the shared chunker.
   */
  private context(): RelationshipLoadContext {
    return (this._context ??= {
      provider: this.provider,
      metadata: this._metadata,
      foreignKeys: this._foreignKeys,
      targetResolver: this._targetResolver,
      chunker: this._chunker,
      grouper: this._grouper,
      chunkSize: DEFAULT_IN_CHUNK_SIZE,
      wrapOne: (entity, ctor) => this.wrapOne(entity, ctor, this.provider),
      wrapMany: (entities, ctor) => this.wrapMany(entities, ctor, this.provider),
      rawTarget: (entity) => this.getRawTarget(entity),
      markLoaded: (entity, propertyName) => {
        const state = this.getEntityState(entity);
        if (state) markLoaded(state, propertyName);
      },
      assignSingle: () => {},
      fetchToOne: async (ctor, id) => {
        const related = await this.provider.findById(id, ctor);
        return related ? this.wrapOne(related, ctor, this.provider) : null;
      },
      absentToMany: [],
      resolveBatchedToOne: (value) => value || null,
      recurseBatched: async () => {}
    });
  }

  private getEntityState(entity: unknown): LazyLoadingState | null {
    return (entity as Record<symbol, unknown>)[LAZY_LOADING_STATE] as LazyLoadingState | null;
  }

  private getRawTarget<T>(entity: T): T {
    const target = (entity as Record<symbol, unknown>)[LAZY_LOADING_TARGET];
    return target !== undefined ? (target as T) : entity;
  }
}
