import type { EntityLoader } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { FilteredIncludeSpec } from '@ts-linq/types';
import { LoadingStrategy, QuerySplittingBehavior } from '@ts-linq/types';

import { IncludeResolutionError } from './errors';
import { resolveTargetCtor } from './includeUtils';

export class IncludePlanner<T> {
  constructor(
    private readonly entityLoader: EntityLoader | undefined,
    private readonly entityClass: new () => T
  ) {}

  /**
   * Populates eager-loaded relationships on the given entities.
   *
   * @param entities           Root entities to populate.
   * @param includes           Dot-separated include paths (e.g. `['posts', 'posts.comments']`).
   * @param limit              When 1, skip loading (single-entity optimisation).
   * @param splittingBehavior  Controls whether relationships are loaded via separate batched
   *                           IN-queries (`SplitQuery`, default) or inlined (`SingleQuery`).
   *                           Both modes currently use the same batched IN-query approach;
   *                           the distinction is preserved for future JOIN-based optimisation.
   * @param filteredIncludes   Optional map of propertyName → FilteredIncludeSpec for filtered
   *                           includes. These are processed first; their top-level keys are
   *                           skipped in the regular batch-loading pass to avoid overwriting
   *                           the already-filtered nav props.
   *
   * @throws {IncludeResolutionError} with code `ENTITY_NOT_REGISTERED` if an entity class
   *   in the include chain has no `@Entity` metadata and nested paths need to be resolved.
   * @throws {IncludeResolutionError} with code `UNKNOWN_PROPERTY` if an include path segment
   *   does not correspond to a declared relationship (e.g. a typo).
   * @throws {IncludeResolutionError} with code `UNRESOLVABLE_TARGET` if the relationship's
   *   `targetEntity` cannot be resolved to a constructor.
   */
  public async populateIncludes(
    entities: T[],
    includes: string[],
    limit?: number,
    splittingBehavior: QuerySplittingBehavior = QuerySplittingBehavior.SplitQuery,
    filteredIncludes?: Map<string, FilteredIncludeSpec>
  ): Promise<void> {
    if (!this.entityLoader) return;
    if (limit === 1) return;
    const hasRegular = includes.length > 0;
    const hasFiltered = (filteredIncludes?.size ?? 0) > 0;
    if (!hasRegular && !hasFiltered) return;

    // Both SplitQuery and SingleQuery use the same batched IN-query strategy.
    // The splittingBehavior is accepted here for future extensibility (JOIN-based loading).
    void splittingBehavior;

    // Process filtered includes first — they populate nav props with the filtered subset.
    if (hasFiltered) {
      await this.entityLoader.populateFilteredRelationshipsMany(
        entities,
        this.entityClass,
        filteredIncludes!
      );
    }

    // Process regular includes, skipping top-level keys already handled by filtered loading.
    if (hasRegular) {
      const alreadyLoaded = filteredIncludes?.size ? new Set(filteredIncludes.keys()) : undefined;
      await this.loadLevel(
        entities,
        this.entityClass as new () => unknown,
        includes,
        '',
        alreadyLoaded
      );
    }
  }

  private async loadLevel(
    entities: unknown[],
    entityClass: new () => unknown,
    includes: string[],
    pathPrefix: string,
    skipTopLevelKeys?: Set<string>
  ): Promise<void> {
    if (entities.length === 0 || includes.length === 0) return;

    // Group includes by their first path segment
    const byFirst = new Map<string, string[]>();
    for (const inc of includes) {
      const dotIdx = inc.indexOf('.');
      const first = dotIdx === -1 ? inc : inc.slice(0, dotIdx);
      const rest = dotIdx === -1 ? null : inc.slice(dotIdx + 1);
      if (!byFirst.has(first)) byFirst.set(first, []);
      if (rest) byFirst.get(first)!.push(rest);
    }

    const topLevelKeys = [...byFirst.keys()];

    // Only batch-load keys that were NOT already populated by filtered loading
    const keysToLoad = skipTopLevelKeys
      ? topLevelKeys.filter((k) => !skipTopLevelKeys.has(k))
      : topLevelKeys;

    if (keysToLoad.length > 0) {
      await this.entityLoader!.populateRelationshipsMany(
        entities as T[],
        entityClass as new () => T,
        {
          strategy: LoadingStrategy.Eager,
          includes: keysToLoad,
          depth: 1
        }
      );
    }

    // Lazily resolve metadata — only needed when recursing into nested paths
    const metadata = MetadataStorage.getEntity(entityClass as new () => unknown);

    for (const [propName, nestedPaths] of byFirst) {
      if (nestedPaths.length === 0) continue;

      const fullPath = pathPrefix ? `${pathPrefix}.${propName}` : propName;

      // Metadata is required for recursion; fail loudly rather than silently skipping
      if (!metadata) {
        throw new IncludeResolutionError(
          'ENTITY_NOT_REGISTERED',
          `Entity '${entityClass.name}' is not registered with @Entity. ` +
            `Ensure the decorator is applied before using thenInclude(). ` +
            `Path: '${fullPath}'.`,
          {
            entityName: entityClass.name,
            propertyPath: fullPath,
            propertyName: propName
          }
        );
      }

      const rel = metadata.relationships.find((r) => r.propertyName === propName);
      if (!rel) {
        throw new IncludeResolutionError(
          'UNKNOWN_PROPERTY',
          `Property '${propName}' does not exist on entity '${entityClass.name}'. ` +
            `Check the include path '${fullPath}' for typos or missing relationship decorators.`,
          { entityName: entityClass.name, propertyPath: fullPath, propertyName: propName }
        );
      }

      const targetCtor = resolveTargetCtor(rel.targetEntity);
      if (!targetCtor) {
        throw new IncludeResolutionError(
          'UNRESOLVABLE_TARGET',
          `Cannot resolve target constructor for relationship '${propName}' on '${entityClass.name}'. ` +
            `The targetEntity may be a string reference or a forward-ref factory that throws. ` +
            `Path: '${fullPath}'.`,
          { entityName: entityClass.name, propertyPath: fullPath, propertyName: propName }
        );
      }

      const navEntities: unknown[] = [];
      for (const entity of entities) {
        const nav = (entity as Record<string, unknown>)[propName];
        if (Array.isArray(nav)) navEntities.push(...nav);
        else if (nav != null) navEntities.push(nav);
      }

      if (navEntities.length > 0) {
        await this.loadLevel(navEntities, targetCtor, nestedPaths, fullPath);
      }
    }
  }
}
