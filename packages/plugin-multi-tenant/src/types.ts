import type { EntityChangeContext, OrmMiddleware } from '@ts-linq/types';

/**
 * Multi-tenant configuration options
 */
export interface MultiTenantOptions {
  /**
   * Enable multi-tenant functionality
   */
  enabled?: boolean;

  /**
   * Column name for tenant ID (default: 'tenantId')
   */
  tenantIdColumn?: string;

  /**
   * Function to get current tenant ID
   */
  getCurrentTenant?(): string | number | Promise<string | number>;

  /**
   * Whether to automatically filter queries by tenant (default: true)
   */
  isolate?: boolean;

  /**
   * Whether to throw error if no tenant is set (default: true)
   */
  strictMode?: boolean;
}

/**
 * Context passed to multi-tenant middleware
 */
export interface TenantContext extends EntityChangeContext {
  operation: 'query' | 'insert' | 'update' | 'delete';
  tenantId?: string | number;
}

/**
 * Multi-tenant middleware interface
 */
export interface MultiTenantMiddleware extends OrmMiddleware {
  beforeQuery?(context: TenantContext): Promise<void> | void;
  beforeSave?(context: TenantContext): Promise<void> | void;
}
