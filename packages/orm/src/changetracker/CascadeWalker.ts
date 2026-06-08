import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef, TrackedEntity } from '@ts-linq/types';
import { DeleteBehavior, EntityState } from '@ts-linq/types';

/**
 * Walks the graph of tracked entities and applies client-side cascade delete behaviors
 * before SaveChanges commits to the database.
 *
 * Behavior matrix:
 * - Cascade / ClientCascade  → dependent entities are marked Deleted (recursive walk)
 * - SetNull / ClientSetNull  → FK column on dependent entities is set to null
 * - Restrict / NoAction / ClientNoAction → no client-side action; DB enforces the constraint
 *
 * Cycle detection: a Set of already-processed (principal entity, dependent entity) pairs
 * prevents infinite recursion on self-referencing or circular FK graphs.
 */
export class CascadeWalker {
  constructor(private readonly registry: MetadataRegistry) {}

  /**
   * Apply cascade behaviors for all currently-deleted entities in the tracked set.
   * Modifies entity state and FK fields in place.
   */
  public walk(allTracked: Map<object, TrackedEntity>): void {
    const visited = new Set<string>();
    const deletedEntities = Array.from(allTracked.values()).filter(
      (te) => te.state === EntityState.Deleted
    );
    for (const deleted of deletedEntities) {
      this._processPrincipal(deleted, allTracked, visited);
    }
  }

  private _processPrincipal(
    principal: TrackedEntity,
    allTracked: Map<object, TrackedEntity>,
    visited: Set<string>
  ): void {
    const principalMeta = this.registry.getEntity(principal.entityClass);
    if (!principalMeta) return;

    const principalPkProp = principalMeta.primaryKeys?.[0];
    const principalPkVal = principalPkProp
      ? (principal.entity as Record<string, unknown>)[principalPkProp]
      : undefined;

    for (const dependent of allTracked.values()) {
      if (dependent === principal) continue;
      if (dependent.state === EntityState.Deleted) continue;

      const depMeta = this.registry.getEntity(dependent.entityClass);
      if (!depMeta) continue;

      for (const rel of depMeta.relationships ?? []) {
        // Only many-to-one / one-to-one (dependent side) can own a FK column.
        if (rel.type !== 'many-to-one' && rel.type !== 'one-to-one') continue;
        if (!rel.foreignKey) continue;
        if (!rel.onDelete) continue;

        // Check whether this relationship references the principal entity type.
        const targetMeta = this._resolveTarget(rel.targetEntity);
        if (!targetMeta) continue;
        if (targetMeta.target !== principal.entityClass) continue;

        const depRec = dependent.entity as Record<string, unknown>;
        const fkVal = depRec[rel.foreignKey];

        // FK must point to this specific principal instance.
        if (principalPkVal === undefined || fkVal !== principalPkVal) continue;

        const visitKey = `${String(principalPkVal)}::${rel.foreignKey}::${String(
          depRec[depMeta.primaryKeys?.[0] ?? ''] ?? ''
        )}`;
        if (visited.has(visitKey)) continue;
        visited.add(visitKey);

        this._applyBehavior(rel.onDelete, dependent, rel.foreignKey, allTracked, visited);
      }
    }
  }

  private _applyBehavior(
    behavior: DeleteBehavior,
    dependent: TrackedEntity,
    fkColumn: string,
    allTracked: Map<object, TrackedEntity>,
    visited: Set<string>
  ): void {
    switch (behavior) {
      case DeleteBehavior.Cascade:
      case DeleteBehavior.ClientCascade:
        dependent.state = EntityState.Deleted;
        // Recurse: this dependent is now deleted, cascade to its own dependents.
        this._processPrincipal(dependent, allTracked, visited);
        break;

      case DeleteBehavior.SetNull:
      case DeleteBehavior.ClientSetNull:
        (dependent.entity as Record<string, unknown>)[fkColumn] = null;
        // Ensure the entity will be saved as Modified.
        if (dependent.state === EntityState.Unchanged) {
          dependent.state = EntityState.Modified;
        }
        break;

      case DeleteBehavior.Restrict:
      case DeleteBehavior.NoAction:
      case DeleteBehavior.ClientNoAction:
        // No client-side action — let the database enforce the constraint.
        break;
    }
  }

  private _resolveTarget(
    targetEntity: string | EntityCtorRef | (() => EntityCtorRef) | undefined
  ): { target?: EntityCtorRef } | undefined {
    if (!targetEntity) return undefined;
    if (typeof targetEntity === 'string') {
      // Look up by class name across all registered entities.
      const all = this.registry.getEntities();
      return all.find((e) => e.className === targetEntity || e.target?.name === targetEntity);
    }
    if (typeof targetEntity === 'function') {
      const meta = this.registry.getEntity(targetEntity as EntityCtorRef);
      if (meta) return meta;
      // Try as lazy factory.
      try {
        const resolved = (targetEntity as () => EntityCtorRef)();
        return resolved ? (this.registry.getEntity(resolved) ?? undefined) : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
