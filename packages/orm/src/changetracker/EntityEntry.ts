import { EntityState } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';

import type { ChangeTracker } from '../ChangeTracker';
import { PropertyEntry } from './PropertyEntry';

export class EntityEntry<T = unknown> {
  constructor(
    public readonly entity: T,
    public readonly entityClass: Function,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly provider: any,
    private readonly changeTracker?: ChangeTracker
  ) {}

  /**
   * Current tracking state of this entity.
   * Setting this value directly updates the tracker — use inside `trackGraph` callbacks.
   */
  get state(): EntityState {
    if (!this.changeTracker) return EntityState.Unchanged;
    return this.changeTracker.getEntityState(this.entity as object);
  }

  set state(value: EntityState) {
    if (!this.changeTracker) {
      throw new Error(
        'Cannot set state: EntityEntry was created without a ChangeTracker. ' +
          'Use context.entry(entity) or obtain the entry via trackGraph.'
      );
    }
    this.changeTracker.setState(this.entity as object, this.entityClass, value);
  }

  /**
   * Returns true when the entity's primary key field is set to a non-empty value.
   * Use inside `trackGraph` callbacks to decide Added vs Modified state.
   */
  get isKeySet(): boolean {
    const meta = MetadataStorage.getEntity(this.entityClass);
    const pk = meta?.primaryKeys?.[0];
    if (!pk) return false;
    const val = (this.entity as Record<string, unknown>)[pk];
    return val !== undefined && val !== null && val !== 0 && val !== '';
  }

  async reload(): Promise<void> {
    const meta = MetadataStorage.getEntity(this.entityClass);
    if (!meta) return;
    const pk = meta.primaryKeys?.[0];
    if (!pk) return;
    const rec = this.entity as Record<string, unknown>;
    const current = await this.provider.findById(rec[pk], this.entityClass);
    if (current) {
      Object.assign(rec, current);
    }
  }

  async getDatabaseValues(): Promise<Partial<T> | null> {
    const meta = MetadataStorage.getEntity(this.entityClass);
    if (!meta) return null;
    const pk = meta.primaryKeys?.[0];
    if (!pk) return null;
    const rec = this.entity as Record<string, unknown>;
    const result = await this.provider.findById(rec[pk], this.entityClass);
    return (result as Partial<T>) ?? null;
  }

  /**
   * Access a shadow property value on this entity entry.
   * Mirrors EF Core's EntityEntry.Property(name).
   */
  property<TValue = unknown>(name: string): PropertyEntry<TValue> {
    if (!this.changeTracker) {
      throw new Error(
        `Cannot access shadow property "${name}": EntityEntry was created without a ChangeTracker. ` +
          `Use context.entry(entity) to get a fully-initialized EntityEntry.`
      );
    }
    return new PropertyEntry<TValue>(this.entity as object, name, this.changeTracker);
  }
}
