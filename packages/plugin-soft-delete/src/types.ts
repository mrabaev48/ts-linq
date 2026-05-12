import type { OrmMiddleware } from '@ts-linq/types';

/**
 * Soft delete configuration options
 */
export interface SoftDeleteOptions {
  /**
   * Enable soft delete functionality
   */
  enabled?: boolean;

  /**
   * Column name for boolean deletion flag (default: 'isDeleted')
   */
  column?: string;

  /**
   * Column name for deletion timestamp (default: 'deletedAt')
   */
  deletedAtColumn?: string;

  /**
   * Type of soft delete: 'boolean' uses isDeleted flag, 'timestamp' uses deletedAt
   */
  type?: 'boolean' | 'timestamp';

  /**
   * Whether to automatically filter out deleted records in queries (default: true)
   */
  filterDeleted?: boolean;
}

/**
 * Context passed to soft delete middleware
 */
export interface SoftDeleteContext {
  entity: Record<string, unknown>;
  entityClass: Function;
  operation: 'delete' | 'restore' | 'hardDelete';
}

/**
 * Soft delete middleware interface
 */
export interface SoftDeleteMiddleware extends OrmMiddleware {
  beforeDelete?(context: SoftDeleteContext): Promise<void> | void;
  afterDelete?(context: SoftDeleteContext): Promise<void> | void;
}
