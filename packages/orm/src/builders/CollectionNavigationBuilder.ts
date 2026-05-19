import type { RelationshipMetadata } from '@ts-linq/types';

import { CollectionReferenceBuilder } from './CollectionReferenceBuilder';
import { extractPropertyName } from './utils';

/**
 * Intermediate fluent builder returned by EntityTypeBuilder.hasMany().
 * Mirrors EF Core's CollectionNavigationBuilder<TEntity, TRelatedEntity>.
 *
 * Many-to-many (withMany) is tracked for P0-08; this builder registers the
 * relationship type so that the navigation property is discoverable, but full
 * join-table configuration requires the CollectionCollectionBuilder (P0-08).
 */
export class CollectionNavigationBuilder<T, TRel> {
  constructor(
    private readonly _ctor: new () => T,
    private readonly _propertyName: string,
    private readonly _relClass: (new () => TRel) | undefined,
    private readonly _relationships: RelationshipMetadata[]
  ) {}

  /**
   * Configure a one-to-many relationship (this entity is the principal side).
   * @param selector  Optional inverse reference navigation selector on TRel.
   */
  withOne(selector?: (r: TRel) => T | undefined): CollectionReferenceBuilder<T, TRel> {
    const inverseSide = selector ? extractPropertyName(selector) : undefined;
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'one-to-many',
      targetEntity: this._relClass,
      inverseSide
    };
    this._mergeRelationship(rel);
    return new CollectionReferenceBuilder<T, TRel>(rel);
  }

  /**
   * Configure a many-to-many relationship.
   * Full UsingEntity / skip navigation support lands in P0-08.
   */
  withMany(selector?: (r: TRel) => T[]): this {
    const inverseSide = selector ? extractPropertyName(selector) : undefined;
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'many-to-many',
      targetEntity: this._relClass,
      inverseSide
    };
    this._mergeRelationship(rel);
    return this;
  }

  private _mergeRelationship(rel: RelationshipMetadata): void {
    const idx = this._relationships.findIndex((r) => r.propertyName === rel.propertyName);
    if (idx >= 0) {
      this._relationships[idx] = rel;
    } else {
      this._relationships.push(rel);
    }
  }
}
