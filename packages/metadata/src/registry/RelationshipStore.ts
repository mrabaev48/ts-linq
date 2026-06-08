import type { EntityCtor, RelationshipMetadata } from '@ts-linq/types';

import type { EntityMetadataState } from './EntityMetadataState';

/**
 * Facet store for entity relationships (foreign-key navigations). Owned
 * entities, complex properties and skip-navigations live in
 * {@link AdvancedMappingStore}; this store covers plain relationships only.
 */
export class RelationshipStore {
  public constructor(private readonly state: EntityMetadataState) {}

  /** Decorator-driven relationship registration (append-only). */
  public addRelationship(target: EntityCtor, relationship: RelationshipMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.relationships = [...finalized.relationships, relationship];
      },
      (builder) => builder.addRelationship(relationship)
    );
  }

  /** Fluent relationship override (fluent wins on conflict via shallow merge). */
  public mergeFluentRelationship(target: EntityCtor, relationship: RelationshipMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        const idx = finalized.relationships.findIndex(
          (r) => r.propertyName === relationship.propertyName
        );
        if (idx >= 0) {
          finalized.relationships[idx] = { ...finalized.relationships[idx], ...relationship };
        } else {
          finalized.relationships = [...finalized.relationships, relationship];
        }
      },
      (builder) => builder.mergeRelationship(relationship)
    );
  }
}
