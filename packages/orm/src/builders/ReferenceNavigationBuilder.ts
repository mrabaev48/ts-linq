import type { RelationshipMetadata } from '@ts-linq/types';

import { ReferenceCollectionBuilder } from './ReferenceCollectionBuilder';
import { ReferenceReferenceBuilder } from './ReferenceReferenceBuilder';
import { extractPropertyName } from './utils';

export class ReferenceNavigationBuilder<T, TRel> {
  constructor(
    private readonly _ownerCtor: new () => T,
    private readonly _propertyName: string,
    private readonly _relClass: (new () => TRel) | undefined,
    private readonly _relationships: RelationshipMetadata[]
  ) {}

  withOne(selector?: (r: TRel) => T | null | undefined): ReferenceReferenceBuilder<T, TRel> {
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'one-to-one',
      targetEntity: this._relClass,
      inverseSide: selector ? extractPropertyName(selector) : undefined
    };
    this._relationships.push(rel);
    return new ReferenceReferenceBuilder<T, TRel>(rel);
  }

  withMany(selector?: (r: TRel) => T[]): ReferenceCollectionBuilder<T, TRel> {
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'many-to-one',
      targetEntity: this._relClass,
      inverseSide: selector ? extractPropertyName(selector) : undefined
    };
    this._relationships.push(rel);
    return new ReferenceCollectionBuilder<T, TRel>(rel);
  }
}
