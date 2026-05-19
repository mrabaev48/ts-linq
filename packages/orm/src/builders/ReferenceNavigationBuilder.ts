import type { RelationshipMetadata } from '@ts-linq/types';

import { ReferenceCollectionBuilder } from './ReferenceCollectionBuilder';
import { ReferenceReferenceBuilder } from './ReferenceReferenceBuilder';
import { extractPropertyName } from './utils';

/**
 * Intermediate fluent builder returned by EntityTypeBuilder.hasOne().
 * Mirrors EF Core's ReferenceNavigationBuilder<TEntity, TRelatedEntity>.
 */
export class ReferenceNavigationBuilder<T, TRel> {
  constructor(
    private readonly _ctor: new () => T,
    private readonly _propertyName: string,
    private readonly _relClass: (new () => TRel) | undefined,
    private readonly _relationships: RelationshipMetadata[]
  ) {}

  /**
   * Configure a one-to-one relationship.
   * @param selector  Optional inverse navigation property selector on TRel.
   */
  withOne(selector?: (r: TRel) => T | undefined): ReferenceReferenceBuilder<T, TRel> {
    const inverseSide = selector ? extractPropertyName(selector) : undefined;
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'one-to-one',
      targetEntity: this._relClass,
      inverseSide
    };
    this._mergeRelationship(rel);
    return new ReferenceReferenceBuilder<T, TRel>(rel);
  }

  /**
   * Configure a many-to-one relationship (this entity is the dependent side).
   * @param selector  Optional inverse collection navigation selector on TRel.
   */
  withMany(selector?: (r: TRel) => T[]): ReferenceCollectionBuilder<T, TRel> {
    const inverseSide = selector ? extractPropertyName(selector) : undefined;
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'many-to-one',
      targetEntity: this._relClass,
      inverseSide
    };
    this._mergeRelationship(rel);
    return new ReferenceCollectionBuilder<T, TRel>(rel);
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
