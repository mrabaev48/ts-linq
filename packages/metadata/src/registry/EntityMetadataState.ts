import type { EntityMetadata } from '@ts-linq/types';

import { EntityMetadataBuilder } from '../EntityMetadata';
import { reflectGetOwnMetadata } from '../reflectUtils';

/**
 * Shared mutation kernel for {@link MetadataRegistry} and its facet stores.
 *
 * Owns the two-stage entity store — `builders` (mutable, pre-finalize accumulators)
 * and `entities` (finalized, immutable descriptors) — and exposes the single
 * Template-Method seam {@link EntityMetadataState.mutate} that every facet mutator
 * routes through. This collapses the "is it finalized or still a builder?" branch
 * that was previously hand-rolled in ~27 registry methods into exactly one place.
 *
 * The kernel deliberately holds no references to facet stores, keeping the
 * dependency graph acyclic (facade → facets → state → builder).
 */
export class EntityMetadataState {
  private readonly entities = new Map<Function, EntityMetadata>();
  private readonly builders = new Map<Function, EntityMetadataBuilder>();

  // ─── Normalization ──────────────────────────────────────────────────────────

  /**
   * Resolve a possibly proxied/wrapped target back to its original class.
   *
   * Decorators may register against a wrapper whose `orm:original` reflection
   * metadata points at the underlying constructor; all store keys use the
   * normalized form so wrapper and original resolve to the same entry.
   */
  public normalizeTarget<T extends Function>(target: T): T {
    if (!target || typeof target !== 'function') return target;
    const maybe = reflectGetOwnMetadata('orm:original', target);
    const original = typeof maybe === 'function' ? (maybe as T) : undefined;
    return original ?? target;
  }

  // ─── Builder helpers ──────────────────────────────────────────────────────────

  /** Lazily create (or return) the pre-finalize accumulator for `target`. */
  public getOrCreateBuilder(target: Function): EntityMetadataBuilder {
    const key = this.normalizeTarget(target);
    if (!this.builders.has(key)) {
      this.builders.set(key, new EntityMetadataBuilder(key));
    }
    return this.builders.get(key)!;
  }

  /** Promote a pending builder into the finalized `entities` map, if present. */
  public finalizeEntity(target: Function): void {
    const key = this.normalizeTarget(target);
    if (this.builders.has(key)) {
      const metadata = this.builders.get(key)!.build();
      this.entities.set(key, metadata);
      this.builders.delete(key);
    }
  }

  /** Promote every pending builder (used by `getEntities`). */
  public finalizeAllBuilders(): void {
    for (const target of this.builders.keys()) {
      this.finalizeEntity(target);
    }
  }

  // ─── Read helpers ─────────────────────────────────────────────────────────────

  /** True if a pending builder exists for the normalized `key`. */
  public hasBuilder(key: Function): boolean {
    return this.builders.has(key);
  }

  /** Finalized descriptor for the normalized `key`, or `undefined`. */
  public getFinalized(key: Function): EntityMetadata | undefined {
    return this.entities.get(key);
  }

  /** Snapshot of all finalized descriptors. */
  public getAllEntities(): EntityMetadata[] {
    return Array.from(this.entities.values());
  }

  // ─── Template Method ──────────────────────────────────────────────────────────

  /**
   * The single finalized-vs-builder dispatch shared by all mutators.
   *
   * If the entity is already finalized, `onFinalized` mutates the immutable
   * descriptor in place; otherwise `onBuilder` accumulates into the pending
   * builder. Both registration styles (decorator and fluent) flow through here.
   */
  public mutate(
    target: Function,
    onFinalized: (metadata: EntityMetadata) => void,
    onBuilder: (builder: EntityMetadataBuilder) => void
  ): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      onFinalized(finalized);
      return;
    }
    onBuilder(this.getOrCreateBuilder(target));
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  /** Drop all finalized descriptors and pending builders. */
  public clearState(): void {
    this.entities.clear();
    this.builders.clear();
  }
}
