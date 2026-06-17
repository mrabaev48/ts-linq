/**
 * Owns shadow property values for tracked entities (P1-16).
 *
 * Extracted from `ChangeTracker` (refactor task-4). Shadow values are stored in a
 * `WeakMap` keyed on the entity reference, parallel to the change tracker's
 * tracked-entity map, so they are garbage-collected together with the entity.
 */
export class ShadowValueStore {
  private readonly values: WeakMap<object, Map<string, unknown>> = new WeakMap();

  /** Read a shadow property value for a tracked entity. */
  get(entity: object, name: string): unknown {
    return this.values.get(entity)?.get(name);
  }

  /** Write a shadow property value for a tracked entity. */
  set(entity: object, name: string, value: unknown): void {
    let map = this.values.get(entity);
    if (!map) {
      map = new Map();
      this.values.set(entity, map);
    }
    map.set(name, value);
  }

  /** Collect all shadow values for a tracked entity (used during persistence). */
  getAll(entity: object): Map<string, unknown> | undefined {
    return this.values.get(entity);
  }
}
