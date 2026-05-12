import type { OrmMiddleware } from '@ts-linq/types';

/**
 * Audit trail configuration options
 */
export interface AuditOptions {
  /**
   * Enable audit functionality
   */
  enabled?: boolean;

  /**
   * Column name for creation timestamp (default: 'createdAt')
   */
  createdAtColumn?: string;

  /**
   * Column name for update timestamp (default: 'updatedAt')
   */
  updatedAtColumn?: string;

  /**
   * Column name for created by user (default: 'createdBy')
   */
  createdByColumn?: string;

  /**
   * Column name for updated by user (default: 'updatedBy')
   */
  updatedByColumn?: string;

  /**
   * Function to get current user ID/name
   */
  getCurrentUser?(): string | number | Promise<string | number>;

  /**
   * Custom clock function for timestamps (useful for testing)
   */
  clock?(): Date;

  /**
   * Time columns configuration (alternative to individual column names)
   */
  timeColumns?: {
    createdAt?: string;
    updatedAt?: string;
  };

  /**
   * User columns configuration (alternative to individual column names)
   */
  userColumns?: {
    createdBy?: string;
    updatedBy?: string;
  };
}

/**
 * Context passed to audit middleware
 */
export interface AuditContext {
  entity: Record<string, unknown>;
  entityClass: Function;
  state: 'added' | 'modified' | 'deleted';
  timestamp?: Date;
  currentUser?: string | number;
}

/**
 * Audit middleware interface
 */
export interface AuditMiddleware extends OrmMiddleware {
  beforeSave?(context: AuditContext): Promise<void> | void;
  afterSave?(context: AuditContext): Promise<void> | void;
}
