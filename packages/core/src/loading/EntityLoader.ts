import type { EntityMetadata, FilteredIncludeSpec, MetadataSource } from '@ts-linq/types';
import { InvalidIncludeError, RelationshipLoadError } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import { getDefaultMetadataSource } from '../defaultMetadataSource';
import { logInternalError } from '../utils/InternalLogger';
import type { LoadingOptions } from './LoadingStrategy';
import { LoadingStrategy } from './LoadingStrategy';
import type { RelationshipLoadContext } from './strategies/RelationshipLoadStrategy';
import { strategyFor } from './strategies/relationshipStrategyRegistry';
import { EntityGrouper } from './support/EntityGrouper';
import { getProp, setProp } from './support/EntityRecord';
import { ForeignKeyConvention } from './support/ForeignKeyConvention';
import { InClauseChunker } from './support/InClauseChunker';
import { asLoadable, type LoadableRelationship } from './support/LoadableRelationship';
import { TargetEntityResolver } from './support/TargetEntityResolver';

/**
 * Orchestrates eager/lazy loading of entities and their relationships. Per-kind
 * loading mechanics live in the shared {@link strategyFor strategy registry};
 * the duplicated FK convention, target resolution, IN()-chunking and grouping
 * live in the shared collaborators under `./support`. This class is now a thin
 * orchestrator: it selects entities, builds the eager {@link RelationshipLoadContext},
 * applies include filtering + depth recursion, and delegates the rest.
 */
export class EntityLoader {
  private _provider: DatabaseProvider;
  private _defaultStrategy: LoadingStrategy = LoadingStrategy.Lazy;
  private readonly _logger?: { warn(message: string, error?: unknown): void };
  private readonly _metadata: MetadataSource;
  private _inChunkSize: number = 1000;

  private readonly _foreignKeys = new ForeignKeyConvention();
  private readonly _targetResolver = new TargetEntityResolver();
  private readonly _chunker = new InClauseChunker();
  private readonly _grouper = new EntityGrouper();

  /**
   * @param provider Database provider used for underlying queries.
   * @param logger   Optional warning logger.
   * @param metadata Metadata source the loader resolves entity metadata from.
   *   Defaults to the global singleton for backward compatibility; the
   *   composition root ({@link DbContext}) injects the per-context registry to
   *   preserve multi-tenant isolation.
   *
   * @deprecated Relying on the implicit global-singleton default defeats
   *   per-context isolation — always inject an explicit `MetadataSource`.
   */
  constructor(
    provider: DatabaseProvider,
    logger?: { warn(message: string, error?: unknown): void },
    metadata: MetadataSource = getDefaultMetadataSource()
  ) {
    this._provider = provider;
    this._logger = logger;
    this._metadata = metadata;
  }

  /** Configure IN() chunk size from PerformanceOptions. */
  public setInChunkSize(size?: number): void {
    if (typeof size === 'number' && size > 0) this._inChunkSize = size;
  }

  /**
   * Set the default loading strategy for operations.
   */
  public setDefaultStrategy(strategy: LoadingStrategy): void {
    this._defaultStrategy = strategy;
  }

  /**
   * Load a single entity by id with optional eager includes or lazy loading.
   */
  public async loadEntity<T extends object>(
    entityClass: new () => T,
    id: unknown,
    options?: LoadingOptions
  ): Promise<T | null> {
    const entity = await this._provider.findById(id, entityClass);
    if (!entity) return null;

    const loadingOptions = {
      strategy: this._defaultStrategy,
      ...options
    };

    if (loadingOptions.strategy === LoadingStrategy.Eager || loadingOptions.includes) {
      await this.loadRelationships(entity, entityClass, loadingOptions);
      return entity;
    } else if (loadingOptions.strategy === LoadingStrategy.Lazy) {
      // Leave navigation properties untouched (undefined) for strict lazy behavior
      return entity;
    }

    return entity;
  }

  /**
   * Load all entities for a given type with optional eager includes or lazy loading.
   */
  public async loadEntities<T extends object>(
    entityClass: new () => T,
    options?: LoadingOptions
  ): Promise<T[]> {
    const entities = await this._provider.findAll(entityClass);

    const loadingOptions = {
      strategy: this._defaultStrategy,
      ...options
    };

    if (loadingOptions.strategy === LoadingStrategy.Eager || loadingOptions.includes) {
      await this.loadRelationshipsBatched(entities, entityClass, loadingOptions);
      return entities;
    } else if (loadingOptions.strategy === LoadingStrategy.Lazy) {
      // Keep plain entities for strict lazy behavior
      return entities;
    }

    return entities;
  }

  /**
   * Populate relationship properties on an entity according to options.
   */
  private async loadRelationships<T>(
    entity: T,
    entityClass: new () => T,
    options: LoadingOptions
  ): Promise<void> {
    this.ensureStage3Init(entityClass);
    const metadata = this._metadata.getEntity(entityClass);
    if (!metadata) return;

    const depth = options.depth ?? 1;
    if (depth <= 0) return;

    if (metadata.target) this.validateIncludes(metadata, options.includes);

    for (const relationship of metadata.relationships) {
      if (!this.shouldInclude(relationship.propertyName, options.includes)) continue;
      const loadable = asLoadable(relationship);
      if (!loadable) continue;
      await this.loadRelationshipByType(entity, entityClass, metadata, loadable, options, depth);
    }
  }

  /** Batched variant to reduce N+1 queries when loading many entities. */
  private async loadRelationshipsBatched<T>(
    entities: T[],
    entityClass: new () => T,
    options: LoadingOptions
  ): Promise<void> {
    if (entities.length === 0) return;
    this.ensureStage3Init(entityClass);
    const metadata = this._metadata.getEntity(entityClass);
    if (!metadata) return;
    const depth = options.depth ?? 1;
    if (depth <= 0) return;

    // Validate provided includes against metadata to fail fast on typos/mistakes
    if (metadata.target) this.validateIncludes(metadata, options.includes);

    for (const relationship of metadata.relationships) {
      if (!this.shouldInclude(relationship.propertyName, options.includes)) continue;
      const loadable = asLoadable(relationship);
      if (!loadable) continue;
      await this.loadRelationshipBatchedByType(
        entities,
        entityClass,
        metadata,
        loadable,
        options,
        depth
      );
    }
  }

  /**
   * Public helper to populate specified relationships on a single entity instance.
   * Useful for post-processing entities fetched by custom queries.
   */
  public async populateRelationships<T>(
    entity: T,
    entityClass: new () => T,
    options: LoadingOptions
  ): Promise<void> {
    await this.loadRelationships(entity, entityClass, options);
  }

  /**
   * Public helper to populate relationships for many entities in a batched way.
   * Reduces N+1 queries by grouping related fetches.
   */
  public async populateRelationshipsMany<T>(
    entities: T[],
    entityClass: new () => T,
    options: LoadingOptions
  ): Promise<void> {
    await this.loadRelationshipsBatched(entities, entityClass, options);
  }

  /**
   * Loads one-to-many relationships for the given entities, then applies the
   * in-memory filter/sort/pagination captured in each `FilteredIncludeSpec`.
   * Only one-to-many relationships are supported; specs for other relationship
   * types are silently skipped.
   *
   * @param entities    Root entities whose nav properties should be populated.
   * @param entityClass Constructor of the root entity type.
   * @param specs       Map of propertyName → FilteredIncludeSpec.
   */
  public async populateFilteredRelationshipsMany<T>(
    entities: T[],
    entityClass: new () => T,
    specs: Map<string, FilteredIncludeSpec>
  ): Promise<void> {
    if (entities.length === 0 || specs.size === 0) return;
    this.ensureStage3Init(entityClass);
    const metadata = this._metadata.getEntity(entityClass);
    if (!metadata) return;

    const parentPkProperty = metadata.primaryKeys?.[0];
    if (!parentPkProperty) return;

    for (const [propName, spec] of specs) {
      const rel = metadata.relationships.find((r) => r.propertyName === propName);
      if (!rel || rel.type !== 'one-to-many') continue;
      const loadable = asLoadable(rel);
      if (!loadable) continue;

      const targetCtor = this._targetResolver.resolve(loadable.targetEntity);

      const parentIds = this._grouper.uniqueDefined(
        entities.map((e) => getProp(e, parentPkProperty))
      );
      if (parentIds.length === 0) continue;

      const foreignKeyName = loadable.foreignKey || this._foreignKeys.defaultFor(entityClass);

      const related = await this._chunker.query(
        this._provider,
        targetCtor,
        foreignKeyName,
        parentIds,
        this._inChunkSize
      );

      const grouped = this._grouper.groupByKey(related, (r) => getProp(r, foreignKeyName));

      // Apply the captured filter/sort/take per parent and assign
      for (const entityItem of entities) {
        const parentId = getProp(entityItem, parentPkProperty);
        const allRelated = grouped.get(parentId) ?? [];
        const filtered = spec.applyFilter(allRelated);
        setProp(entityItem, propName, filtered);
      }
    }
  }

  // ===== Helper methods =====

  /**
   * Construct a throwaway instance to trigger stage-3 field-decorator
   * initializers (e.g. `@ValidIf`/`@RequiredIfOf`) that register metadata on
   * first construction. Entities whose constructor legitimately requires
   * arguments will throw here; that is expected and non-fatal, but the failure
   * is surfaced through the single internal-error channel rather than dropped
   * silently.
   */
  private ensureStage3Init<T>(entityClass: new () => T): void {
    try {
      void new entityClass();
    } catch (e) {
      logInternalError('EntityLoader.ensureStage3Init', e);
    }
  }

  private validateIncludes(metadata: EntityMetadata, includes?: string[]): void {
    if (!includes) return;
    const targetName = metadata.target?.name ?? metadata.className ?? 'entity';
    for (const inc of includes) {
      const exists = metadata.relationships.some((r) => r.propertyName === inc);
      if (!exists)
        throw new InvalidIncludeError(`Invalid include '${inc}' for ${targetName}`, {
          details: { include: inc, entity: targetName }
        });
    }
  }

  private shouldInclude(property: string, includes?: string[]): boolean {
    return !includes || includes.includes(property);
  }

  private async loadRelationshipByType(
    entity: unknown,
    entityClass: new () => unknown,
    metadata: EntityMetadata,
    relationship: LoadableRelationship,
    options: LoadingOptions,
    depth: number
  ): Promise<void> {
    try {
      const strategy = strategyFor(relationship.type);
      if (!strategy) return;
      await strategy.loadSingle(
        this.buildEagerContext(options, depth),
        entity,
        entityClass as new () => object,
        metadata,
        relationship
      );
    } catch (error) {
      // A failed relationship load must be observable: keep the warn telemetry,
      // route through the internal-error channel, and surface a typed error so
      // callers never receive a silently half-populated entity.
      this._logger?.warn(`Failed to load relationship ${relationship.propertyName}:`, error);
      logInternalError('EntityLoader.loadRelationshipByType', error);
      throw new RelationshipLoadError(
        `Failed to load relationship '${relationship.propertyName}' for ${entityClass.name}`,
        {
          cause: error,
          details: { relationship: relationship.propertyName, entity: entityClass.name }
        }
      );
    }
  }

  private async loadRelationshipBatchedByType(
    entities: unknown[],
    entityClass: new () => unknown,
    metadata: EntityMetadata,
    relationship: LoadableRelationship,
    options: LoadingOptions,
    depth: number
  ): Promise<void> {
    const strategy = strategyFor(relationship.type);
    if (!strategy) return;
    await strategy.loadBatch(
      this.buildEagerContext(options, depth),
      entities,
      entityClass as new () => object,
      metadata,
      relationship
    );
  }

  /**
   * Build the eager-loading context for the strategy registry: identity proxy
   * hooks, no-op `markLoaded`, real `assignSingle`, recursive `fetchToOne`
   * (depth-1) and `recurseBatched` (depth-gated), and an `undefined`
   * `absentToMany` so absent single to-many sources leave the property
   * untouched — preserving the historical `EntityLoader` behaviour exactly.
   */
  private buildEagerContext(options: LoadingOptions, depth: number): RelationshipLoadContext {
    return {
      provider: this._provider,
      metadata: this._metadata,
      foreignKeys: this._foreignKeys,
      targetResolver: this._targetResolver,
      chunker: this._chunker,
      grouper: this._grouper,
      chunkSize: this._inChunkSize,
      wrapOne: (entity) => entity,
      wrapMany: (entities) => entities,
      rawTarget: (entity) => entity,
      markLoaded: () => {},
      assignSingle: (entity, propertyName, value) => {
        setProp(entity, propertyName, value);
      },
      fetchToOne: async (ctor, id) => this.loadEntity(ctor, id, { ...options, depth: depth - 1 }),
      absentToMany: undefined,
      resolveBatchedToOne: (value) => value,
      recurseBatched: async (related, ctor) =>
        depth - 1 > 0
          ? this.loadRelationshipsBatched(related as object[], ctor, {
              ...options,
              depth: depth - 1
            })
          : Promise.resolve()
    };
  }
}

// DbSetWithIncludes was removed in favor of predicate-based include API on Queryable
