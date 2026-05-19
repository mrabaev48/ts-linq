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
 *
 * All configuration is accumulated internally and flushed to the MetadataRegistry
 * via _finalize(), which DbContext calls after onModelCreating() returns.
 */
export class ModelBuilder {
  private readonly _builders: Map<Function, EntityTypeBuilder<unknown>> = new Map();

  /** @internal Injected by DbContext. */
  constructor(private readonly _registry: MetadataRegistry) {}

  // ── Entity configuration ───────────────────────────────────────────────────

  /**
   * Configure an entity type, optionally using an inline callback.
   * Mirrors EF Core: modelBuilder.Entity<T>(b => { ... })
   *
   * Multiple calls for the same entity class are merged (last write wins per
   * property/key, consistent with EF Core conventions).
   */
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

  // ── Configuration class support ────────────────────────────────────────────

  /**
   * Apply a single IEntityTypeConfiguration<T> instance.
   * Mirrors EF Core: modelBuilder.ApplyConfiguration(new UserConfiguration())
   */
  applyConfiguration<T>(config: IEntityTypeConfiguration<T>): this {
    const builder = this.entity(config.entityType);
    config.configure(builder);
    return this;
  }

  /**
   * Scan module exports for IEntityTypeConfiguration implementations and apply
   * each one.
   * Mirrors EF Core: modelBuilder.ApplyConfigurationsFromAssembly(typeof(Ctx).Assembly)
   *
   * In TypeScript there are no assemblies; pass an array of module export
   * objects instead:
   *   mb.applyConfigurationsFromAssembly([require('./configs/UserConfig')])
   *
   * A value is treated as a configuration class when its instances expose both
   * a `configure` method and an `entityType` property (the minimal
   * IEntityTypeConfiguration<T> shape).
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

  // ── Internal ───────────────────────────────────────────────────────────────

  /**
   * Flush all accumulated EntityTypeBuilder configurations to the registry.
   * Called by DbContext after onModelCreating() returns, before initializeDbSets().
   *
   * @internal
   */
  _finalize(): void {
    for (const builder of this._builders.values()) {
      builder._applyToRegistry(this._registry);
    }
  }
}
