import type { MetadataRegistry } from '@ts-linq/metadata';

/**
 * Mutable cross-aspect data shared during a single
 * {@link EntityTypeBuilder}`._applyToRegistry()` pass.
 *
 * Aspects may publish values consumed by later aspects in the declared apply order,
 * making previously implicit ordering dependencies explicit and testable.
 */
export interface AspectApplyContext {
  /**
   * Primary keys published by `KeyAndTableAspect` and consumed by `SkipNavigationAspect`
   * (the many-to-many left-side foreign key derives from `primaryKeys[0]`).
   *
   * This turns the old implicit "skip-nav after primary keys" sequencing into an explicit
   * data dependency: `KeyAndTableAspect` must run before `SkipNavigationAspect`.
   */
  primaryKeys?: string[];
}

/**
 * A cohesive, per-concern slice of entity configuration.
 *
 * Each aspect owns its own accumulators (fed by the fluent `EntityTypeBuilder` methods it
 * backs) and writes them to the `MetadataRegistry` in {@link applyTo}. Adding a new mapping
 * feature means adding a new aspect rather than editing existing ones (Open/Closed).
 */
export interface EntityConfigAspect<T extends object> {
  /**
   * Writes this aspect's accumulated configuration to the registry for `ctor`.
   * @param ctx per-pass context for publishing/consuming cross-aspect data.
   */
  applyTo(registry: MetadataRegistry, ctor: new () => T, ctx: AspectApplyContext): void;
}
