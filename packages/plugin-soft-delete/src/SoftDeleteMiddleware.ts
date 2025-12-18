import { MetadataStorage } from '@ts-linq/metadata';
import type { OrmMiddleware, EntityChangeContext } from '@ts-linq/types';
import type { SoftDeleteOptions, SoftDeleteContext } from './types';

/**
 * Middleware that handles soft delete operations
 * Implements OrmMiddleware interface for DbContext integration
 */
export class SoftDeleteMiddleware implements OrmMiddleware {
  private options: SoftDeleteOptions;

  constructor(options: SoftDeleteOptions = {}) {
    this.options = {
      enabled: true,
      column: 'isDeleted',
      deletedAtColumn: 'deletedAt',
      type: 'boolean',
      filterDeleted: true,
      ...options
    };
  }

  /**
   * OrmMiddleware lifecycle hook - called before delete
   * Returns true if soft-delete was handled (prevents hard delete)
   */
  async beforeDelete(context: EntityChangeContext): Promise<boolean> {
    if (!this.options.enabled) {
      return false;
    }

    const meta = MetadataStorage.getEntity(context.entityClass);
    if (!meta) {
      return false;
    }

    const flagColumn = this.options.column!;
    const timestampColumn = this.options.deletedAtColumn!;

    const hasFlagColumn = meta.columns.some(
      (c: any) => c.propertyName === flagColumn || c.columnName === flagColumn
    );

    const hasTimestampColumn = meta.columns.some(
      (c: any) => c.propertyName === timestampColumn || c.columnName === timestampColumn
    );

    if (!hasFlagColumn && !hasTimestampColumn) {
      return false;
    }

    // Mark as soft deleted
    if (hasFlagColumn) {
      (context.entity as Record<string, unknown>)[flagColumn] = true;
    }
    if (hasTimestampColumn) {
      (context.entity as Record<string, unknown>)[timestampColumn] = new Date();
    }
    
    return true; // Prevents hard delete, DbContext will do update instead
  }

  /**
   * Handle soft delete operation (legacy method for backward compatibility)
   */
  async handleSoftDelete(context: SoftDeleteContext): Promise<boolean> {
    if (!this.options.enabled) {
      return false;
    }

    const meta = MetadataStorage.getEntity(context.entityClass);
    if (!meta) {
      return false;
    }

    const flagColumn = this.options.column!;
    const timestampColumn = this.options.deletedAtColumn!;

    const hasFlagColumn = meta.columns.some(
      (c: any) => c.propertyName === flagColumn || c.columnName === flagColumn
    );

    const hasTimestampColumn = meta.columns.some(
      (c: any) => c.propertyName === timestampColumn || c.columnName === timestampColumn
    );

    if (!hasFlagColumn && !hasTimestampColumn) {
      return false;
    }

    if (context.operation === 'delete') {
      if (hasFlagColumn) {
        context.entity[flagColumn] = true;
      }
      if (hasTimestampColumn) {
        context.entity[timestampColumn] = new Date();
      }
      return true;
    } else if (context.operation === 'restore') {
      if (hasFlagColumn) {
        context.entity[flagColumn] = false;
      }
      if (hasTimestampColumn) {
        context.entity[timestampColumn] = null;
      }
      return true;
    }

    return false;
  }

  /**
   * Check if entity is soft deleted
   */
  isSoftDeleted(entity: Record<string, unknown>): boolean {
    const flagColumn = this.options.column!;
    const timestampColumn = this.options.deletedAtColumn!;

    if (this.options.type === 'boolean') {
      return entity[flagColumn] === true;
    } else {
      return entity[timestampColumn] != null;
    }
  }

  /**
   * Get filter for excluding soft-deleted records
   */
  getFilterCondition(): string {
    if (!this.options.filterDeleted) {
      return '';
    }

    if (this.options.type === 'boolean') {
      return `${this.options.column} = 0 OR ${this.options.column} IS NULL`;
    } else {
      return `${this.options.deletedAtColumn} IS NULL`;
    }
  }
}
