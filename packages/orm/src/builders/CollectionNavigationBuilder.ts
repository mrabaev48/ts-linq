import type { RelationshipMetadata } from '@ts-linq/types';

import { CollectionCollectionBuilder } from './CollectionCollectionBuilder';
import { CollectionReferenceBuilder } from './CollectionReferenceBuilder';
import { extractPropertyName } from './utils';

export class CollectionNavigationBuilder<T, TRel> {
  constructor(
    private readonly _ownerCtor: new () => T,
    private readonly _propertyName: string,
    private readonly _relClass: (new () => TRel) | undefined,
    private readonly _relationships: RelationshipMetadata[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly _skipNavBuilders?: CollectionCollectionBuilder<T, any>[]
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

  withMany(selector?: (r: TRel) => T[]): CollectionCollectionBuilder<T, TRel> {
    const inverseSide = selector ? extractPropertyName(selector) : undefined;
    // Push a stub relationship (will be replaced with a proper `through` rel in _applyToRegistry)
    const rel: RelationshipMetadata = {
      propertyName: this._propertyName,
      type: 'many-to-many',
      targetEntity: this._relClass,
      inverseSide
    };
    this._relationships.push(rel);
    const builder = new CollectionCollectionBuilder<T, TRel>(
      this._ownerCtor,
      this._propertyName,
      this._relClass,
      inverseSide,
      this._relationships
    );
    this._skipNavBuilders?.push(builder);
    return builder;
  }
}
