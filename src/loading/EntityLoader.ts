import { LoadingStrategy, LoadingOptions } from './LoadingStrategy';
import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';

/**
 * Service responsible for loading entities with either lazy or eager strategy,
 * including recursive loading of relationships based on provided options.
 */
export class EntityLoader {
  private _provider: DatabaseProvider;
  private _defaultStrategy: LoadingStrategy = LoadingStrategy.Lazy;

  /**
   * @param provider Database provider used for underlying queries.
   */
  constructor(provider: DatabaseProvider) {
    this._provider = provider;
  }

  /**
   * Set the default loading strategy for operations.
   */
  public setDefaultStrategy(strategy: LoadingStrategy): void {
    this._defaultStrategy = strategy;
  }

  /**
   * Load a single entity by id with optional eager includes.
   */
  public async loadEntity<T>(
    entityClass: new () => T,
    id: any,
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
    }

    return entity;
  }

  /**
   * Load all entities for a given type with optional eager includes.
   */
  public async loadEntities<T>(entityClass: new () => T, options?: LoadingOptions): Promise<T[]> {
    const entities = await this._provider.findAll(entityClass);

    const loadingOptions = {
      strategy: this._defaultStrategy,
      ...options
    };

    if (loadingOptions.strategy === LoadingStrategy.Eager || loadingOptions.includes) {
      await this.loadRelationshipsBatched(entities, entityClass, loadingOptions);
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
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;

    const depth = options.depth ?? 1;
    if (depth <= 0) return;

    for (const relationship of metadata.relationships) {
      if (options.includes) {
        // Validate includes against metadata upfront
        for (const inc of options.includes) {
          const exists = metadata.relationships.some((r) => r.propertyName === inc);
          if (!exists) throw new Error(`Invalid include '${inc}' for ${metadata.target.name}`);
        }
      }
      const shouldInclude =
        !options.includes || options.includes.includes(relationship.propertyName);
      if (!shouldInclude) continue;

      try {
        const targetCtor = this.resolveTargetEntity(relationship.targetEntity);

        switch (relationship.type) {
          case 'many-to-one':
          case 'one-to-one': {
            const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
            const foreignKeyValue = (entity as any)[foreignKeyName];
            if (foreignKeyValue === undefined || foreignKeyValue === null) {
              break;
            }
            const relatedEntity = await this.loadEntity(
              targetCtor as new () => any,
              foreignKeyValue,
              { ...options, depth: depth - 1 }
            );
            if (relatedEntity) {
              (entity as any)[relationship.propertyName] = relatedEntity;
            }
            break;
          }

          case 'one-to-many': {
            const parentPkProperty = metadata.primaryKeys[0];
            if (!parentPkProperty) {
              break;
            }
            const parentPkValue = (entity as any)[parentPkProperty];
            if (parentPkValue === undefined || parentPkValue === null) {
              break;
            }
            const foreignKeyName =
              relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
            const relatedEntities = await this._provider.findWhere(targetCtor as new () => any, {
              [foreignKeyName]: parentPkValue
            });
            (entity as any)[relationship.propertyName] = relatedEntities;
            break;
          }
        }
      } catch (error) {
        console.warn(`Failed to load relationship ${relationship.propertyName}:`, error);
      }
    }
  }

  /** Batched variant to reduce N+1 queries when loading many entities. */
  private async loadRelationshipsBatched<T>(
    entities: T[],
    entityClass: new () => T,
    options: LoadingOptions
  ): Promise<void> {
    if (entities.length === 0) return;
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;
    const depth = options.depth ?? 1;
    if (depth <= 0) return;

    for (const relationship of metadata.relationships) {
      const shouldInclude =
        !options.includes || options.includes.includes(relationship.propertyName);
      if (!shouldInclude) continue;

      const targetCtor = this.resolveTargetEntity(relationship.targetEntity) as new () => any;

      switch (relationship.type) {
        case 'many-to-one':
        case 'one-to-one': {
          const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
          const fkValues = entities
            .map((e) => (e as any)[foreignKeyName])
            .filter((v) => v !== undefined && v !== null);
          const uniqueFkValues = Array.from(new Set(fkValues));
          if (uniqueFkValues.length === 0) break;
          const related = await this._provider.findWhereIn(
            targetCtor,
            metadata.columns.find((c) => c.propertyName === metadata.primaryKeys[0])?.columnName ||
              metadata.primaryKeys[0],
            uniqueFkValues
          );
          const byId = new Map<any, any>();
          const targetMeta = MetadataStorage.getEntity(targetCtor);
          const targetPk = targetMeta?.primaryKeys[0];
          for (const relatedEntity of related)
            byId.set((relatedEntity as any)[targetPk!], relatedEntity);
          for (const entityItem of entities) {
            const fk = (entityItem as any)[foreignKeyName];
            if (fk !== undefined && fk !== null) {
              (entityItem as any)[relationship.propertyName] = byId.get(fk);
            }
          }
          // Recurse for next depth level on distinct related
          if (depth - 1 > 0) {
            await this.loadRelationshipsBatched(Array.from(byId.values()), targetCtor, {
              ...options,
              depth: depth - 1
            });
          }
          break;
        }
        case 'one-to-many': {
          const parentPkProperty = metadata.primaryKeys[0];
          if (!parentPkProperty) break;
          const parentIds = entities
            .map((e) => (e as any)[parentPkProperty])
            .filter((v) => v !== undefined && v !== null);
          const uniqueParentIds = Array.from(new Set(parentIds));
          if (uniqueParentIds.length === 0) break;
          const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
          const related = await this._provider.findWhereIn(
            targetCtor,
            foreignKeyName,
            uniqueParentIds
          );
          const grouped = new Map<any, any[]>();
          for (const relatedEntity of related) {
            const key = (relatedEntity as any)[foreignKeyName];
            const arr = grouped.get(key) || [];
            arr.push(relatedEntity);
            grouped.set(key, arr);
          }
          for (const entityItem of entities) {
            const parentId = (entityItem as any)[parentPkProperty];
            (entityItem as any)[relationship.propertyName] = grouped.get(parentId) || [];
          }
          if (depth - 1 > 0) {
            await this.loadRelationshipsBatched(related, targetCtor, {
              ...options,
              depth: depth - 1
            });
          }
          break;
        }
      }
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
   * Resolve a relationship target that may be provided either as a constructor
   * or as a lazy callback returning the constructor.
   * @param target Constructor or thunk returning a constructor
   * @returns Concrete constructor function for the target entity
   */
  private resolveTargetEntity(target: Function | (() => Function)) {
    const maybeCtor = target as any;
    if (typeof maybeCtor === 'function' && maybeCtor.prototype && maybeCtor.prototype.constructor) {
      return maybeCtor as new () => any;
    }
    const resolved = (target as () => Function)();
    return resolved as new () => any;
  }

  /**
   * Compute a default foreign key name for a given type using the convention
   * camelCase(typeName) + 'Id', e.g., User -> userId.
   * @param type Target constructor
   * @returns Conventional foreign key column name
   */
  private defaultForeignKeyFor(type: Function): string {
    const name = type.name || 'id';
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    return `${camel}Id`;
  }
}

// DbSetWithIncludes was removed in favor of predicate-based include API on Queryable
