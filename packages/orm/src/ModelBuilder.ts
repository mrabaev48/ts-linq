import type { MetadataRegistry } from '@ts-linq/metadata';

import { EntityTypeBuilder } from './builders/EntityTypeBuilder';
import type { IEntityTypeConfiguration } from './builders/IEntityTypeConfiguration';

/**
 * Central fluent configuration surface for the ORM model.
 * Mirrors EF Core's ModelBuilder.
 *
 * Usage inside DbContext:
 *   protected onModelCreating(mb: ModelBuilder): void {
 *     mb.entity(User, b => {
 *       b.toTable('users');
 *       b.hasKey('id');
 *       b.property(u => u.email).hasMaxLength(256).isRequired();
 *     });
 *   }
 */
export class ModelBuilder {
  private readonly _builders: Map<Function, EntityTypeBuilder<unknown>> = new Map();

  constructor(private readonly _registry: MetadataRegistry) {}

  entity<T>(
    ctor: new () => T,
    configure?: (b: EntityTypeBuilder<T>) => void
  ): EntityTypeBuilder<T> {
    if (!this._builders.has(ctor)) {
      this._builders.set(ctor, new EntityTypeBuilder<T>(ctor) as EntityTypeBuilder<unknown>);
    }
    const builder = this._builders.get(ctor) as EntityTypeBuilder<T>;
    if (configure) configure(builder);
    return builder;
  }

  applyConfiguration<T>(config: IEntityTypeConfiguration<T>): this {
    const builder = this.entity(config.entityType);
    config.configure(builder);
    return this;
  }

  /**
   * Scan module exports for IEntityTypeConfiguration implementations and apply each one.
   * Pass an array of module export objects:
   *   mb.applyConfigurationsFromAssembly([require('./configs/UserConfig')])
   */
  applyConfigurationsFromAssembly(modules: Record<string, unknown>[]): this {
    for (const mod of modules) {
      for (const exported of Object.values(mod)) {
        if (typeof exported !== 'function') continue;
        const proto = (exported as { prototype?: unknown }).prototype;
        if (typeof (proto as Record<string, unknown>)?.configure !== 'function') continue;
        const instance = new (exported as new () => IEntityTypeConfiguration<unknown>)();
        if (typeof instance.entityType !== 'function') continue;
        this.applyConfiguration(instance);
      }
    }
    return this;
  }

  /** @internal — called by DbContext after onModelCreating() returns. */
  _finalize(): void {
    for (const builder of this._builders.values()) {
      builder._applyToRegistry(this._registry);
    }
  }
}
