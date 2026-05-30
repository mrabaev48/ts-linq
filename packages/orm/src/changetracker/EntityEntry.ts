import { MetadataStorage } from '@ts-linq/metadata';

export class EntityEntry<T = unknown> {
  constructor(
    public readonly entity: T,
    public readonly entityClass: Function,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly provider: any
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
}
