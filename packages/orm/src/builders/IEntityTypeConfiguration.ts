import type { EntityTypeBuilder } from './EntityTypeBuilder';

/**
 * Mirrors EF Core's IEntityTypeConfiguration<T>.
 *
 * Implement this interface to encapsulate entity configuration in a dedicated
 * class and register it via ModelBuilder.applyConfiguration() or
 * ModelBuilder.applyConfigurationsFromAssembly().
 *
 * NOTE: TypeScript erases generics at runtime, so an explicit `entityType`
 * property is required so the ModelBuilder knows which entity class to build.
 */
export interface IEntityTypeConfiguration<T> {
  /** The entity constructor this configuration applies to. */
  readonly entityType: new () => T;
  /** Apply configuration to the given builder. */
  configure(builder: EntityTypeBuilder<T>): void;
}
