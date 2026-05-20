import type {
  InterceptionResult,
  ISaveChangesInterceptor,
  SaveChangesEventData
} from '@ts-linq/core';
import type { AuditOptions } from '@ts-linq/types';

import type { AuditColumnNames } from '../types';

interface ColumnMeta {
  propertyName: string;
}

interface EntityMeta {
  columns: ReadonlyArray<ColumnMeta>;
}

type GetMeta = (entityClass: Function) => EntityMeta | undefined;

/** @internal */
export class AuditInterceptor implements ISaveChangesInterceptor {
  constructor(
    private readonly audit: AuditOptions | undefined,
    private readonly getMeta: GetMeta
  ) {}

  apply(change: { entity: Record<string, unknown>; entityClass: Function; state: string }): void {
    if (!this.audit?.enabled) return;
    const meta = this.getMeta(change.entityClass);
    if (!meta) return;
    const names = this.extractAuditNames(this.audit);
    if (!names) return;
    const now = (this.audit.clock ?? (() => new Date()))();
    const currentUser = this.audit.getCurrentUser?.();

    if (change.state === 'added') {
      this.applyCreated(meta, change.entity, names, now, currentUser);
    }
    if (change.state === 'added' || change.state === 'modified') {
      this.applyUpdated(meta, change.entity, names, now, currentUser);
    }
  }

  extractAuditNames(audit?: AuditOptions): AuditColumnNames | undefined {
    if (!audit) return undefined;
    return {
      createdAt: audit.timeColumns?.createdAt ?? audit.createdAtColumn ?? 'createdAt',
      updatedAt: audit.timeColumns?.updatedAt ?? audit.updatedAtColumn ?? 'updatedAt',
      createdBy: audit.userColumns?.createdBy ?? audit.createdByColumn ?? 'createdBy',
      updatedBy: audit.userColumns?.updatedBy ?? audit.updatedByColumn ?? 'updatedBy'
    };
  }

  private applyCreated(
    meta: EntityMeta,
    entity: Record<string, unknown>,
    names: AuditColumnNames,
    now: Date,
    currentUser: unknown
  ): void {
    if (this.hasProperty(meta, names.createdAt)) entity[names.createdAt] = now;
    if (this.hasProperty(meta, names.createdBy) && currentUser !== undefined)
      entity[names.createdBy] = currentUser;
  }

  private applyUpdated(
    meta: EntityMeta,
    entity: Record<string, unknown>,
    names: AuditColumnNames,
    now: Date,
    currentUser: unknown
  ): void {
    if (this.hasProperty(meta, names.updatedAt)) entity[names.updatedAt] = now;
    if (this.hasProperty(meta, names.updatedBy) && currentUser !== undefined)
      entity[names.updatedBy] = currentUser;
  }

  private hasProperty(meta: EntityMeta, propertyName: string): boolean {
    return meta.columns.some((c) => c.propertyName === propertyName);
  }

  // ── ISaveChangesInterceptor ──────────────────────────────────────────────

  /**
   * Applies audit timestamps/user fields to all pending entries before DML.
   * Iterates the SaveChangesEventData entries and delegates to the existing
   * per-entity `apply()` logic.
   */
  savingChanges(
    ev: SaveChangesEventData,
    result: InterceptionResult<number>
  ): InterceptionResult<number> {
    if (!this.audit?.enabled) return result;
    for (const entry of ev.entries ?? []) {
      this.apply({
        entity: entry.entity as Record<string, unknown>,
        entityClass: entry.entityClass,
        state: entry.state
      });
    }
    return result;
  }
}
