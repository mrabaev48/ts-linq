import type { MultiTenantOptions, TenantContext } from './types';
/**
 * Middleware that handles multi-tenant operations
 */
export declare class MultiTenantMiddleware {
    private options;
    private currentTenant?;
    constructor(options?: MultiTenantOptions);
    /**
     * Set current tenant ID
     */
    setTenant(tenantId: string | number | undefined): void;
    /**
     * Get current tenant ID
     */
    getTenant(): Promise<string | number | undefined>;
    /**
     * Apply tenant ID to entity
     */
    applyTenant(context: TenantContext): Promise<void>;
    /**
     * Get filter condition for tenant isolation
     */
    getFilterCondition(): Promise<string | null>;
    /**
     * Check if entity belongs to current tenant
     */
    belongsToTenant(entity: Record<string, unknown>): Promise<boolean>;
    /**
     * Clear current tenant
     */
    clearTenant(): void;
}
//# sourceMappingURL=MultiTenantMiddleware.d.ts.map