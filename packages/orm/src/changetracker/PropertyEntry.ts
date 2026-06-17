import type { IChangeTrackerForEntry } from './IChangeTrackerForEntry';

/**
 * Accessor for a single shadow property value on a tracked entity.
 * Mirrors EF Core's PropertyEntry<TEntity, TProperty>.
 */
export class PropertyEntry<TValue = unknown> {
  constructor(
    private readonly entity: object,
    private readonly name: string,
    private readonly changeTracker: IChangeTrackerForEntry
  ) {}

  get currentValue(): TValue {
    return this.changeTracker.getShadowValue(this.entity, this.name) as TValue;
  }

  set currentValue(value: TValue) {
    this.changeTracker.setShadowValue(this.entity, this.name, value);
  }
}
