import type { MetadataRegistry } from '@ts-linq/metadata';
import type { RelationshipMetadata } from '@ts-linq/types';

import { ReferenceNavigationBuilder } from '../ReferenceNavigationBuilder';
import { extractPropertyName } from '../utils';
import type { EntityConfigAspect } from './EntityConfigAspect';

/**
 * Explicit reference/collection relationships configured via `hasOne` / `hasMany`.
 *
 * The `relationships` array is exposed so `EntityTypeBuilder.hasMany()` — which bridges this
 * aspect and `SkipNavigationAspect` for the many-to-many case — can wire the collection
 * navigation builder against it.
 */
export class RelationshipAspect<T extends object> implements EntityConfigAspect<T> {
  readonly relationships: RelationshipMetadata[] = [];

  constructor(private readonly _ctor: new () => T) {}

  hasOne<TRel extends object>(
    selector: (e: T) => TRel | null | undefined,
    relClass?: new () => TRel
  ): ReferenceNavigationBuilder<T, TRel> {
    const propName = extractPropertyName(selector);
    return new ReferenceNavigationBuilder<T, TRel>(
      this._ctor,
      propName,
      relClass,
      this.relationships
    );
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T): void {
    for (const rel of this.relationships) {
      registry.mergeFluentRelationship(ctor, rel);
    }
  }
}
