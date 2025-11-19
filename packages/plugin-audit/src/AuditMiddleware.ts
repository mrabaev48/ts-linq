import { MetadataStorage } from '@ts-linq/metadata';
import type { AuditOptions, AuditContext } from './types';

/**
 * Middleware that handles audit trail operations
 */
export class AuditMiddleware {
  private options: AuditOptions;

  constructor(options: AuditOptions = {}) {
    this.options = {
      enabled: true,
      createdAtColumn: 'createdAt',
      updatedAtColumn: 'updatedAt',
      createdByColumn: 'createdBy',
      updatedByColumn: 'updatedBy',
      ...options
    };
  }

  /**
   * Apply audit information to entity
   */
  async applyAudit(context: AuditContext): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const meta = MetadataStorage.getEntity(context.entityClass);
    if (!meta) {
      return;
    }

    const now = context.timestamp || (this.options.clock?.() ?? new Date());
    const currentUser = context.currentUser ?? (await this.getCurrentUserId());

    if (context.state === 'added') {
      this.applyCreatedAudit(meta, context.entity, now, currentUser);
    }

    if (context.state === 'added' || context.state === 'modified') {
      this.applyUpdatedAudit(meta, context.entity, now, currentUser);
    }
  }

  /**
   * Apply created audit fields
   */
  private applyCreatedAudit(
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    entity: Record<string, unknown>,
    now: Date,
    currentUser: string | number | undefined
  ): void {
    const createdAtCol = this.options.timeColumns?.createdAt || this.options.createdAtColumn!;
    const createdByCol = this.options.userColumns?.createdBy || this.options.createdByColumn!;

    if (this.hasProperty(meta, createdAtCol)) {
      entity[createdAtCol] = now;
    }

    if (this.hasProperty(meta, createdByCol) && currentUser !== undefined) {
      entity[createdByCol] = currentUser as any;
    }
  }

  /**
   * Apply updated audit fields
   */
  private applyUpdatedAudit(
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    entity: Record<string, unknown>,
    now: Date,
    currentUser: string | number | undefined
  ): void {
    const updatedAtCol = this.options.timeColumns?.updatedAt || this.options.updatedAtColumn!;
    const updatedByCol = this.options.userColumns?.updatedBy || this.options.updatedByColumn!;

    if (this.hasProperty(meta, updatedAtCol)) {
      entity[updatedAtCol] = now;
    }

    if (this.hasProperty(meta, updatedByCol) && currentUser !== undefined) {
      entity[updatedByCol] = currentUser as any;
    }
  }

  /**
   * Check if entity has a property
   */
  private hasProperty(
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    propertyName: string
  ): boolean {
    return meta.columns.some(
      (c: any) => c.propertyName === propertyName || c.columnName === propertyName
    );
  }

  /**
   * Get current user ID
   */
  private async getCurrentUserId(): Promise<string | number | undefined> {
    if (!this.options.getCurrentUser) {
      return undefined;
    }

    try {
      return await Promise.resolve(this.options.getCurrentUser());
    } catch {
      return undefined;
    }
  }
}
