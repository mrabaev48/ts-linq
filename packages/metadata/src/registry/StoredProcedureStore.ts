import type { EntityCtor, EntityStoredProcedureMapping } from '@ts-linq/types';

import type { EntityMetadataState } from './EntityMetadataState';

/**
 * Facet store for stored-procedure CUD mappings (P2-33).
 *
 * SP mappings bypass the builder/finalize lifecycle entirely — they are always
 * mutable and keyed directly — so this store owns its own map and uses the
 * kernel only for target normalization.
 */
export class StoredProcedureStore {
  private readonly spMappings = new Map<EntityCtor, EntityStoredProcedureMapping>();

  public constructor(private readonly state: EntityMetadataState) {}

  /** Set (replace) the stored procedure CUD mapping for an entity. */
  public setStoredProcedureMapping(
    target: EntityCtor,
    mapping: EntityStoredProcedureMapping
  ): void {
    const key = this.state.normalizeTarget(target);
    this.spMappings.set(key, mapping);
  }

  /** Get the stored procedure CUD mapping for an entity, if configured. */
  public getStoredProcedureMapping(target: EntityCtor): EntityStoredProcedureMapping | undefined {
    const key = this.state.normalizeTarget(target);
    return this.spMappings.get(key);
  }

  /** Drop all stored procedure mappings. */
  public clear(): void {
    this.spMappings.clear();
  }
}
