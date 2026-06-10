import type { EntityCtor, EntityRef } from '@ts-linq/types';

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
   * behaviour exactly. The single `as` narrows the abstract {@link EntityCtor}
   * to the concrete `new () => object` the providers require — no `as unknown`
   * double-cast (core/task-7).
   */
  public resolve(target: EntityRef): new () => object {
    const ctor = this.isThunk(target) ? target() : target;
    return ctor as new () => object;
  }

  /** A thunk target is a function without a `prototype`; a class constructor has one. */
  private isThunk(target: EntityRef): target is () => EntityCtor {
    return typeof target === 'function' && !(target as { prototype?: unknown }).prototype;
  }
}
