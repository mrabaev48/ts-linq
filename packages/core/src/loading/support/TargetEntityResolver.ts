import type { EntityRef } from '@ts-linq/types';

/**
 * Single source of relationship-target resolution shared by every loader.
 *
 * A relationship target may be provided either as a constructor or as a lazy
 * thunk returning the constructor (`() => Target`, used to break declaration
 * cycles). Previously duplicated as `resolveTargetEntity` in both loaders.
 */
export class TargetEntityResolver {
  /**
   * Resolve a relationship target to a concrete constructor.
   *
   * A class constructor exposes a truthy `prototype`; an arrow thunk does not,
   * so we call it to obtain the constructor. This mirrors the historical
   * behaviour exactly.
   */
  public resolve(target: EntityRef): new () => object {
    const maybeCtor = target as { prototype?: unknown };
    if (typeof target === 'function' && 'prototype' in maybeCtor && maybeCtor.prototype) {
      return target as unknown as new () => object;
    }
    return (target as () => unknown)() as unknown as new () => object;
  }
}
