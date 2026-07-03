import type { MetadataRegistry } from '@ts-linq/metadata';

import type { CollectionCollectionBuilder } from '../CollectionCollectionBuilder';
import type { AspectApplyContext, EntityConfigAspect } from './EntityConfigAspect';

/**
 * Many-to-many skip navigations (synthesised join entities).
 *
 * PK-dependent: the left-side foreign key derives from the owner's first primary key, so this
 * aspect must run after `KeyAndTableAspect` (which publishes `ctx.primaryKeys`). The
 * `skipNavBuilders` array is populated by the `CollectionNavigationBuilder.withMany()` chain.
 */
export class SkipNavigationAspect<T extends object> implements EntityConfigAspect<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly skipNavBuilders: CollectionCollectionBuilder<T, any>[] = [];

  applyTo(registry: MetadataRegistry, _ctor: new () => T, ctx: AspectApplyContext): void {
    // Left PK is required before the m2m join can be synthesised (see AspectApplyContext).
    const leftPk = ctx.primaryKeys?.[0] ?? 'id';
    for (const snb of this.skipNavBuilders) {
      snb._applyToRegistry(registry, leftPk, 'id');
    }
  }
}
