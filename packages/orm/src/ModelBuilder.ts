import type { MetadataRegistry } from '@ts-linq/metadata';
import type { QueryFilterMetadata } from '@ts-linq/types';

import { EntityTypeBuilder } from './builders/EntityTypeBuilder';
import type { IEntityTypeConfiguration } from './builders/IEntityTypeConfiguration';
import {
  type GlobalConverterRule,
  PropertiesConfigBuilder
} from './builders/PropertiesConfigBuilder';

/** Per-DbContext query filter map: entityClass → named filters. */
export type EntityQueryFilterMap = Map<Function, ReadonlyArray<QueryFilterMetadata>>;

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
  private readonly _globalConverterRules: Map<Function, GlobalConverterRule> = new Map();
  /** Collected after _finalize(). Keys are entity constructors. */
  private _queryFilterMap?: EntityQueryFilterMap;

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

  /**
   * Registers a global default converter for all entity properties whose TypeScript type
   * matches `ctor`. Uses Reflect.getMetadata('design:type') for matching.
   * Mirrors EF Core's ModelBuilder.Properties<T>().HaveConversion().
   *
   * @example
   *   mb.properties(Date).haveConversion(DateOnlyToStringConverter);
   */
  properties<T>(ctor: abstract new (...args: unknown[]) => T): PropertiesConfigBuilder<T> {
    return new PropertiesConfigBuilder<T>(ctor, this._globalConverterRules);
  }

  /** @internal — returns per-context entity query filter map after _finalize() was called. */
  _getQueryFilterMap(): EntityQueryFilterMap {
    return this._queryFilterMap ?? new Map();
  }

  /** @internal — called by DbContext after onModelCreating() returns. */
  _finalize(): void {
    // Collect per-context query filters before applying to registry
    const filterMap: EntityQueryFilterMap = new Map();
    for (const [ctor, builder] of this._builders.entries()) {
      builder._applyToRegistry(this._registry);
      const filters = builder._getQueryFilters();
      if (filters.length > 0) {
        filterMap.set(ctor, filters);
      }
    }
    this._queryFilterMap = filterMap;

    if (this._globalConverterRules.size === 0) return;

    // Apply global converter rules to columns whose reflected type matches
    const allEntities = this._registry.getEntities();
    for (const entityMeta of allEntities) {
      if (!entityMeta.target) continue;
      const proto = (entityMeta.target as Function).prototype as object;
      for (const col of entityMeta.columns) {
        if (col.converter) continue; // explicit converter takes priority
        const reflectedType = this.safeGetDesignType(proto, col.propertyName);
        if (!reflectedType) continue;
        const rule = this._globalConverterRules.get(reflectedType);
        if (rule) {
          col.converter = rule.converter;
          if (rule.comparer && !col.comparer) col.comparer = rule.comparer;
        }
      }
    }
  }

  private safeGetDesignType(proto: object, propertyName: string): Function | undefined {
    try {
      return Reflect.getMetadata('design:type', proto, propertyName) as Function | undefined;
    } catch {
      return undefined;
    }
  }
}
