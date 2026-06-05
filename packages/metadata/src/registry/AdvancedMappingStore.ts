import type {
  ComplexTypePropertyMetadata,
  EntityCtor,
  HierarchyMetadata,
  OwnedEntityMetadata,
  QueryFilterMetadata,
  SkipNavigationMetadata
} from '@ts-linq/types';

import type { EntityMetadataState } from './EntityMetadataState';

/**
 * Facet store for structural advanced mappings: owned entities, complex
 * properties, inheritance hierarchy wiring, skip-navigations and query filters.
 * Each routes through {@link EntityMetadataState.mutate}.
 */
export class AdvancedMappingStore {
  public constructor(private readonly state: EntityMetadataState) {}

  /** Register a complex (value-object) property on the owner entity (P1-17). */
  public addComplexProperty(owner: Function, complex: ComplexTypePropertyMetadata): void {
    this.state.mutate(
      owner,
      (finalized) => {
        finalized.complexProperties = [...(finalized.complexProperties ?? []), complex];
      },
      (builder) => builder.addComplexProperty(complex)
    );
  }

  /** Register an owned entity relationship for the given owner entity (P0-06). */
  public addOwnedEntity(owner: Function, owned: OwnedEntityMetadata): void {
    this.state.mutate(
      owner,
      (finalized) => {
        finalized.ownedEntities = [...(finalized.ownedEntities || []), owned];
      },
      (builder) => builder.addOwnedEntity(owned)
    );
  }

  /** Set hierarchy metadata on the root entity. */
  public setHierarchyMetadata(target: Function, h: HierarchyMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.hierarchy = h;
      },
      (builder) => builder.setHierarchy(h)
    );
  }

  /** Mark a subtype entity as belonging to a hierarchy rooted at `root`. */
  public setHierarchyRoot(subtype: Function, root: Function): void {
    this.state.mutate(
      subtype,
      (finalized) => {
        // task-5: registry keys remain `Function`; the hierarchy root is a constructor.
        finalized.hierarchyRoot = root as EntityCtor;
      },
      (builder) => builder.setHierarchyRoot(root)
    );
  }

  /** Register or replace a skip navigation on an entity. */
  public mergeFluentSkipNavigation(target: Function, nav: SkipNavigationMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.skipNavigations = finalized.skipNavigations ?? [];
        const idx = finalized.skipNavigations.findIndex(
          (sn) => sn.propertyName === nav.propertyName
        );
        if (idx >= 0) {
          finalized.skipNavigations[idx] = nav;
        } else {
          finalized.skipNavigations.push(nav);
        }
      },
      (builder) => builder.addSkipNavigation(nav)
    );
  }

  /** Register or replace a named query filter on an entity (P0-11). */
  public mergeFluentQueryFilter(target: Function, filter: QueryFilterMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.queryFilters = finalized.queryFilters ?? [];
        const idx = finalized.queryFilters.findIndex((f) => f.name === filter.name);
        if (idx >= 0) {
          finalized.queryFilters[idx] = filter;
        } else {
          finalized.queryFilters.push(filter);
        }
      },
      (builder) => builder.addQueryFilter(filter)
    );
  }
}
