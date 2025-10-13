import type { LoadingOptions } from './LoadingStrategy';
import { LoadingStrategy } from './LoadingStrategy';
import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/core';

/**
 * Service responsible for loading entities with either lazy or eager strategy,
 * including recursive loading of relationships based on provided options.
 */
export class EntityLoader {
  private _provider: DatabaseProvider;
  private _defaultStrategy: LoadingStrategy = LoadingStrategy.Lazy;
  private readonly _logger?: { warn(message: string, error?: unknown): void };

  /**
   * @param provider Database provider used for underlying queries.
   */
  constructor(
    provider: DatabaseProvider,
    logger?: { warn(message: string, error?: unknown): void }
  ) {
    this._provider = provider;
    this._logger = logger;
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
      return entities;
    }

    return entities;
  }

  /** Populate relationship properties on an entity according to options. */
  private async loadRelationships<T>(
    entity: T,
    entityClass: new () => T,
    options: LoadingOptions
  ): Promise<void> {
    this.ensureStage3Init(entityClass);
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;

    const depth = options.depth ?? 1;
    if (depth <= 0) return;

    this.validateIncludes(metadata, options.includes);

    for (const relationship of metadata.relationships) {
      if (!this.shouldInclude(relationship.propertyName, options.includes)) continue;
      await this.loadRelationshipByType(
        entity as unknown,
        entityClass as unknown as new () => unknown,
        metadata,
        relationship as unknown as {
          propertyName: string;
          foreignKey?: string;
          type: string;
          targetEntity: Function | (() => Function);
        },
        options,
        depth
      );
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
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;
    const depth = options.depth ?? 1;
    if (depth <= 0) return;

    this.validateIncludes(
      metadata as unknown as {
        relationships: Array<{ propertyName: string }>;
        target: { name: string };
      },
      options.includes
    );

    for (const relationship of metadata.relationships) {
      if (!this.shouldInclude(relationship.propertyName, options.includes)) continue;
      await this.loadRelationshipBatchedByType(
        entities as unknown as unknown[],
        entityClass as unknown as new () => unknown,
        metadata,
        relationship as unknown as {
          propertyName: string;
          foreignKey?: string;
          type: string;
          targetEntity: Function | (() => Function);
        },
        options,
        depth
      );
    }
  }

  public async populateRelationships<T>(
    entity: T,
    entityClass: new () => T,
    options: LoadingOptions
  ): Promise<void> {
    await this.loadRelationships(entity, entityClass, options);
  }

  public async populateRelationshipsMany<T>(
    entities: T[],
    entityClass: new () => T,
    options: LoadingOptions
  ): Promise<void> {
    await this.loadRelationshipsBatched(entities, entityClass, options);
  }

  private resolveTargetEntity(target: Function | (() => Function)) {
    const maybeCtor = target as { prototype?: unknown } | (() => Function);
    if (typeof maybeCtor === 'function' && 'prototype' in maybeCtor && maybeCtor.prototype) {
      return maybeCtor as unknown as new () => unknown;
    }
    const resolved = (target as () => Function)();
    return resolved as unknown as new () => unknown;
  }

  private defaultForeignKeyFor(type: Function): string {
    const name = type.name || 'id';
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    return `${camel}Id`;
  }

  private ensureStage3Init<T>(entityClass: new () => T): void {
    try {
      void new entityClass();
    } catch {}
  }

  private validateIncludes(
    metadata: { relationships: Array<{ propertyName: string }>; target: { name: string } },
    includes?: string[]
  ): void {
    if (!includes) return;
    for (const inc of includes) {
      const exists = metadata.relationships.some((r) => r.propertyName === inc);
      if (!exists) throw new Error(`Invalid include '${inc}' for ${metadata.target.name}`);
    }
  }

  private shouldInclude(property: string, includes?: string[]): boolean {
    return !includes || includes.includes(property);
  }

  private async loadToOne(
    entity: unknown,
    relationship: {
      propertyName: string;
      foreignKey?: string;
    },
    targetCtor: new () => unknown,
    nextOptions: LoadingOptions
  ): Promise<void> {
    const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
    const foreignKeyValue = (entity as Record<string, unknown>)[foreignKeyName];
    if (foreignKeyValue === undefined || foreignKeyValue === null) return;
    const relatedEntity = await this.loadEntity(
      targetCtor as new () => object,
      foreignKeyValue,
      nextOptions
    );
    if (relatedEntity)
      (entity as Record<string, unknown>)[relationship.propertyName] = relatedEntity as unknown;
  }

  private async loadOneToMany(
    entity: unknown,
    metadata: { primaryKeys: string[] },
    relationship: { propertyName: string; foreignKey?: string },
    entityClass: new () => unknown,
    targetCtor: new () => unknown
  ): Promise<void> {
    const parentPkProperty = metadata.primaryKeys[0];
    if (!parentPkProperty) return;
    const parentPkValue = (entity as Record<string, unknown>)[parentPkProperty];
    if (parentPkValue === undefined || parentPkValue === null) return;
    const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
    const relatedEntities = await this._provider.findWhere(targetCtor as new () => object, {
      [foreignKeyName]: parentPkValue
    });
    (entity as Record<string, unknown>)[relationship.propertyName] = relatedEntities as unknown;
  }

  private getPrimaryKeyColumnName(meta: {
    columns: Array<{ propertyName: string; columnName: string }>;
    primaryKeys: string[];
  }): string {
    const pkProp = meta.primaryKeys[0];
    return meta.columns.find((c) => c.propertyName === pkProp)?.columnName || pkProp;
  }

  private async loadRelationshipByType(
    entity: unknown,
    entityClass: new () => unknown,
    metadata: { primaryKeys: string[] },
    relationship: {
      propertyName: string;
      foreignKey?: string;
      type: string;
      targetEntity: Function | (() => Function);
    },
    options: LoadingOptions,
    depth: number
  ): Promise<void> {
    try {
      const targetCtor = this.resolveTargetEntity(relationship.targetEntity) as new () => unknown;
      if (relationship.type === 'one-to-many') {
        await this.loadOneToMany(entity, metadata, relationship, entityClass, targetCtor);
      } else {
        await this.loadToOne(entity, relationship, targetCtor, { ...options, depth: depth - 1 });
      }
    } catch (error) {
      this._logger?.warn(`Failed to load relationship ${relationship.propertyName}:`, error);
    }
  }

  private async loadRelationshipBatchedByType(
    entities: unknown[],
    entityClass: new () => unknown,
    metadata: {
      columns?: Array<{ propertyName: string; columnName: string }>;
      primaryKeys: string[];
    },
    relationship: {
      propertyName: string;
      foreignKey?: string;
      type: string;
      targetEntity: Function | (() => Function);
    },
    options: LoadingOptions,
    depth: number
  ): Promise<void> {
    const targetCtor = this.resolveTargetEntity(relationship.targetEntity) as new () => unknown;
    if (relationship.type === 'one-to-many') {
      await this.loadOneToManyBatched(
        entities,
        { primaryKeys: metadata.primaryKeys },
        relationship,
        entityClass,
        targetCtor,
        options,
        depth
      );
      return;
    }
    await this.loadToOneBatched(
      entities,
      { columns: metadata.columns ?? [], primaryKeys: metadata.primaryKeys },
      relationship,
      targetCtor,
      options,
      depth
    );
  }

  private async loadToOneBatched(
    entities: unknown[],
    meta: { columns: Array<{ propertyName: string; columnName: string }>; primaryKeys: string[] },
    relationship: { propertyName: string; foreignKey?: string },
    targetCtor: new () => unknown,
    options: LoadingOptions,
    depth: number
  ): Promise<void> {
    const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
    const fkValues = entities
      .map((e) => (e as Record<string, unknown>)[foreignKeyName])
      .filter((v) => v !== undefined && v !== null);
    const uniqueFkValues = Array.from(new Set(fkValues));
    if (uniqueFkValues.length === 0) return;

    const targetPkColumn = this.getPrimaryKeyColumnName(meta);
    const related = await this._provider.findWhereIn(
      targetCtor as new () => object,
      targetPkColumn,
      uniqueFkValues
    );
    const byId = new Map<unknown, unknown>();
    const targetMeta = MetadataStorage.getEntity(targetCtor);
    const targetPk = targetMeta?.primaryKeys[0];
    for (const relatedEntity of related)
      byId.set((relatedEntity as Record<string, unknown>)[targetPk as string], relatedEntity);

    for (const entityItem of entities) {
      const fk = (entityItem as Record<string, unknown>)[foreignKeyName];
      if (fk !== undefined && fk !== null)
        (entityItem as Record<string, unknown>)[relationship.propertyName] = byId.get(fk);
    }

    if (depth - 1 > 0)
      await this.loadRelationshipsBatched(
        Array.from(byId.values()),
        targetCtor as new () => object,
        {
          ...options,
          depth: depth - 1
        }
      );
  }

  private async loadOneToManyBatched(
    entities: unknown[],
    meta: { primaryKeys: string[] },
    relationship: { propertyName: string; foreignKey?: string },
    entityClass: new () => unknown,
    targetCtor: new () => unknown,
    options: LoadingOptions,
    depth: number
  ): Promise<void> {
    const parentPkProperty = meta.primaryKeys[0];
    if (!parentPkProperty) return;
    const parentIds = entities
      .map((e) => (e as Record<string, unknown>)[parentPkProperty])
      .filter((v) => v !== undefined && v !== null);
    const uniqueParentIds = Array.from(new Set(parentIds));
    if (uniqueParentIds.length === 0) return;

    const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
    const related = await this._provider.findWhereIn(
      targetCtor as new () => object,
      foreignKeyName,
      uniqueParentIds
    );
    const grouped = new Map<unknown, unknown[]>();
    for (const relatedEntity of related) {
      const key = (relatedEntity as Record<string, unknown>)[foreignKeyName];
      const arr = grouped.get(key) || [];
      arr.push(relatedEntity);
      grouped.set(key, arr);
    }
    for (const entityItem of entities) {
      const parentId = (entityItem as Record<string, unknown>)[parentPkProperty];
      (entityItem as Record<string, unknown>)[relationship.propertyName] = (grouped.get(parentId) ||
        []) as unknown;
    }
    if (depth - 1 > 0)
      await this.loadRelationshipsBatched(related as unknown[], targetCtor as new () => object, {
        ...options,
        depth: depth - 1
      });
  }
}
