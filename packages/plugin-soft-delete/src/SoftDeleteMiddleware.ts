import { MetadataStorage } from '@ts-linq/metadata';

import type { SoftDeleteContext, SoftDeleteOptions } from './types';

/**
 * Middleware that handles soft delete operations
 */
export class SoftDeleteMiddleware {
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
   * Handle soft delete operation
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

    // Check if entity has soft delete columns
    const hasFlagColumn = meta.columns.some(
      (c) => c.propertyName === flagColumn || c.columnName === flagColumn
    );

    const hasTimestampColumn = meta.columns.some(
      (c) => c.propertyName === timestampColumn || c.columnName === timestampColumn
    );

    if (!hasFlagColumn && !hasTimestampColumn) {
      return false;
    }

    if (context.operation === 'delete') {
      // Mark as deleted
      if (hasFlagColumn) {
        context.entity[flagColumn] = true;
      }
      if (hasTimestampColumn) {
        context.entity[timestampColumn] = new Date();
      }
      return true;
    } else if (context.operation === 'restore') {
      // Restore deleted entity
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
