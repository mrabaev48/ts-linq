import type { MultiTenantOptions } from './types';
/**
 * Helper to create multi-tenant options
 */
export declare function withTenant(options?: Partial<MultiTenantOptions>): MultiTenantOptions;
/**
 * Create a tenant-scoped context wrapper
 */
export declare function createTenantScope<T>(tenantId: string | number, fn: () => T | Promise<T>): () => Promise<T>;
/**
 * Extract tenant ID from entity
 */
export declare function getTenantId(entity: Record<string, unknown>, options?: Partial<MultiTenantOptions>): string | number | undefined;
/**
 * Check if entity has tenant column
 */
export declare function hasTenantColumn(entity: Record<string, unknown>, options?: Partial<MultiTenantOptions>): boolean;
/**
 * Set tenant ID on entity
 */
export declare function setTenantId(entity: Record<string, unknown>, tenantId: string | number, options?: Partial<MultiTenantOptions>): void;
//# sourceMappingURL=utils.d.ts.map