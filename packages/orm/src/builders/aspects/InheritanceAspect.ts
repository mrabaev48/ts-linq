import type { MetadataRegistry } from '@ts-linq/metadata';
import { InheritanceStrategy } from '@ts-linq/types';

import { DiscriminatorBuilder } from '../DiscriminatorBuilder';
import type { EntityConfigAspect } from './EntityConfigAspect';

/**
 * Inheritance storage strategy (TPH / TPT / TPC) and the TPH discriminator.
 *
 * `hasDiscriminator` implies TPH and returns the `DiscriminatorBuilder` used to register
 * subtypes; the explicit `useTph/Tpt/Tpc` selectors set the strategy directly.
 */
export class InheritanceAspect<T extends object> implements EntityConfigAspect<T> {
  private _inheritanceStrategy?: InheritanceStrategy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _discriminatorBuilder?: DiscriminatorBuilder<any>;

  hasDiscriminator<TKey>(name: string, type: string): DiscriminatorBuilder<TKey> {
    this._inheritanceStrategy = InheritanceStrategy.Tph;
    const builder = new DiscriminatorBuilder<TKey>(name, type);
    this._discriminatorBuilder = builder;
    return builder;
  }

  useTph(): void {
    this._inheritanceStrategy = InheritanceStrategy.Tph;
  }

  useTpt(): void {
    this._inheritanceStrategy = InheritanceStrategy.Tpt;
  }

  useTpc(): void {
    this._inheritanceStrategy = InheritanceStrategy.Tpc;
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T): void {
    if (this._inheritanceStrategy === undefined) return;

    const disc = this._discriminatorBuilder?._buildMetadata();
    const subtypes = disc?.entries.map((e) => e.ctor) ?? [];
    registry.setHierarchyMetadata(ctor, {
      strategy: this._inheritanceStrategy,
      rootEntity: ctor,
      discriminator: disc,
      subtypes
    });
    for (const sub of subtypes) {
      registry.setHierarchyRoot(sub, ctor);
    }
  }
}
