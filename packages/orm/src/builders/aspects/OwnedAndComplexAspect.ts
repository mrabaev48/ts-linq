import type { MetadataRegistry } from '@ts-linq/metadata';

import { ComplexTypeBuilder } from '../ComplexTypeBuilder';
import { OwnedNavigationBuilder } from '../OwnedNavigationBuilder';
import { extractPropertyName } from '../utils';
import type { EntityConfigAspect } from './EntityConfigAspect';

function resolveOwnedArgs<TOwned extends object, TOwner>(
  ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<TOwner, TOwned>) => void),
  configure?: (b: OwnedNavigationBuilder<TOwner, TOwned>) => void
): [new () => TOwned, ((b: OwnedNavigationBuilder<TOwner, TOwned>) => void) | undefined] {
  // Arrow functions have undefined prototype; class constructors have an object prototype.
  if (typeof ownedCtorOrConfigure === 'function' && ownedCtorOrConfigure.prototype !== undefined) {
    return [ownedCtorOrConfigure as new () => TOwned, configure];
  }
  return [
    Object as unknown as new () => TOwned,
    ownedCtorOrConfigure as ((b: OwnedNavigationBuilder<TOwner, TOwned>) => void) | undefined
  ];
}

/**
 * Owned entity types (`ownsOne` / `ownsMany`) and complex-type properties (`complexProperty`).
 *
 * Owned navigation builders need the owner constructor, so this aspect is constructed with it.
 */
export class OwnedAndComplexAspect<T extends object> implements EntityConfigAspect<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _ownedBuilders: OwnedNavigationBuilder<T, any>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _complexBuilders: ComplexTypeBuilder<any>[] = [];

  constructor(private readonly _ctor: new () => T) {}

  ownsOne<TOwned extends object>(
    selector: (e: T) => TOwned | undefined,
    ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<T, TOwned>) => void),
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void
  ): OwnedNavigationBuilder<T, TOwned> {
    return this._addOwned(selector, false, ownedCtorOrConfigure, configure);
  }

  ownsMany<TOwned extends object>(
    selector: (e: T) => TOwned[],
    ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<T, TOwned>) => void),
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void
  ): OwnedNavigationBuilder<T, TOwned> {
    return this._addOwned(selector, true, ownedCtorOrConfigure, configure);
  }

  complexProperty<TComplex>(
    selector: (e: T) => TComplex | undefined,
    configure?: (b: ComplexTypeBuilder<NonNullable<TComplex>>) => void
  ): void {
    const propName = extractPropertyName(selector);
    const builder = new ComplexTypeBuilder<NonNullable<TComplex>>(propName);
    if (configure) configure(builder);
    this._complexBuilders.push(builder);
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T): void {
    for (const ob of this._ownedBuilders) {
      registry.addOwnedEntity(ctor, ob._buildMetadata());
    }

    for (const cb of this._complexBuilders) {
      registry.addComplexProperty(ctor, cb._build());
    }
  }

  private _addOwned<TOwned extends object>(
    selector: (e: T) => TOwned | TOwned[] | undefined,
    isCollection: boolean,
    ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<T, TOwned>) => void),
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void
  ): OwnedNavigationBuilder<T, TOwned> {
    const propName = extractPropertyName(selector);
    const [resolvedCtor, resolvedConfigure] = resolveOwnedArgs(ownedCtorOrConfigure, configure);
    const builder = new OwnedNavigationBuilder<T, TOwned>(
      this._ctor,
      resolvedCtor as new () => TOwned,
      propName,
      isCollection
    );
    resolvedConfigure?.(builder);
    this._ownedBuilders.push(builder);
    return builder;
  }
}
