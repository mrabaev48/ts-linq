import {
  defaultPropertyAccessor,
  type MetadataRegistry,
  type PropertyAccessor
} from '@ts-linq/metadata';
import type { EntityCtorRef, TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

import type { EqualityComparer } from './EqualityComparer';
import type { ShadowValueStore } from './ShadowValueStore';

/**
 * Detects dirty entities by comparing their current state against the stored
 * `originalValues` snapshot. Extracted from `ChangeTracker` (refactor task-4).
 *
 * All structural comparison flows through the single injected {@link EqualityComparer}
 * strategy; per-column value comparers (P0-05) take precedence as an override when
 * configured, matching EF Core semantics.
 */
export class ChangeDetector {
  constructor(
    private readonly registry: MetadataRegistry,
    private readonly comparer: EqualityComparer,
    private readonly shadowStore: ShadowValueStore
  ) {}

  /**
   * Scan tracked entities and mark each Unchanged one Modified when its current
   * state differs from the stored `originalValues` (or any shadow value changed).
   */
  detectChanges(tracked: Iterable<TrackedEntity>): void {
    for (const t of tracked) {
      if (t.state === EntityState.Unchanged && t.originalValues) {
        if (
          this.hasChanged(t.entity, t.originalValues, t.entityClass) ||
          this.hasShadowChanged(t.entity, t.entityClass)
        ) {
          t.state = EntityState.Modified;
        }
      }
    }
  }

  hasChanged(entity: object, original: object, entityClass: EntityCtorRef): boolean {
    const meta = this.registry.getEntity(entityClass);
    if (!meta) return !this.comparer.equals(entity, original);

    for (const col of meta.columns) {
      const accessor =
        (col.accessor as PropertyAccessor | undefined) ?? defaultPropertyAccessor(col.propertyName);
      const current = accessor.get(entity);
      // Original snapshot was cloned from the entity; use the same accessor to read it.
      const prev = accessor.get(original);
      if (col.comparer) {
        if (!col.comparer.equals(current, prev)) return true;
      } else {
        if (!this.comparer.equals(current, prev)) return true;
      }
    }

    // Check complex type properties using deep structural equality (value semantics, P1-17).
    const rec = entity as Record<string, unknown>;
    const origRec = original as Record<string, unknown>;
    for (const cp of meta.complexProperties ?? []) {
      if (!this.comparer.equals(rec[cp.propertyName], origRec[cp.propertyName])) return true;
    }

    return false;
  }

  hasShadowChanged(entity: object, entityClass: EntityCtorRef): boolean {
    const meta = this.registry.getEntity(entityClass);
    if (!meta?.shadowProperties) return false;
    const shadowValues = this.shadowStore.getAll(entity);
    if (!shadowValues) return false;
    // Any shadow value set after attach counts as a change.
    return shadowValues.size > 0;
  }
}
