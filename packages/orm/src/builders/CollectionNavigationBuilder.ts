import type { RelationshipMetadata } from '@ts-linq/types';

import { CollectionReferenceBuilder } from './CollectionReferenceBuilder';
import { extractPropertyName } from './utils';

export class CollectionNavigationBuilder<T, TRel> {
  constructor(
    private readonly _ownerCtor: new () => T,
    private readonly _propertyName: string,
    private readonly _relClass: (new () => TRel) | undefined,
    private readonly _relationships: RelationshipMetadata[]
  ) {}

  withOne(selector?: (r: TRel) => T | null | undefined): CollectionReferenceBuilder<T, TRel> {
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'one-to-many',
      targetEntity: this._relClass,
      inverseSide: selector ? extractPropertyName(selector) : undefined
    };
    this._relationships.push(rel);
    return new CollectionReferenceBuilder<T, TRel>(rel);
  }

  withMany(selector?: (r: TRel) => T[]): this {
    // Many-to-many (P0-08); stores the relationship stub for now.
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'many-to-many',
      targetEntity: this._relClass,
      inverseSide: selector ? extractPropertyName(selector) : undefined
    };
    this._relationships.push(rel);
    return this;
  }
}
