import type { MultiTenantOptions } from './types';

/**
 * Helper to create multi-tenant options
 */
export function withTenant(options: Partial<MultiTenantOptions> = {}): MultiTenantOptions {
  return {
    enabled: true,
    tenantIdColumn: 'tenantId',
    isolate: true,
    strictMode: true,
    ...options
  };
}

/**
 * Create a tenant-scoped context wrapper
 */
export function createTenantScope<T>(
  tenantId: string | number,
  fn: () => T | Promise<T>
): () => Promise<T> {
  return async () => {
    // This will be used with middleware.setTenant()
    return await Promise.resolve(fn());
  };
}

/**
 * Extract tenant ID from entity
 */
export function getTenantId(
  entity: Record<string, unknown>,
  options: Partial<MultiTenantOptions> = {}
): string | number | undefined {
  const column = options.tenantIdColumn || 'tenantId';
  return entity[column] as string | number | undefined;
}

/**
 * Check if entity has tenant column
 */
export function hasTenantColumn(
  entity: Record<string, unknown>,
  options: Partial<MultiTenantOptions> = {}
): boolean {
  const column = options.tenantIdColumn || 'tenantId';
  return column in entity;
}

/**
 * Set tenant ID on entity
 */
export function setTenantId(
  entity: Record<string, unknown>,
  tenantId: string | number,
  options: Partial<MultiTenantOptions> = {}
): void {
  const column = options.tenantIdColumn || 'tenantId';
  entity[column] = tenantId;
}
