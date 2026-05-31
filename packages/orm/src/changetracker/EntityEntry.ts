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
