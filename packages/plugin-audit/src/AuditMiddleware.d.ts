import type { AuditOptions, AuditContext } from './types';
/**
 * Middleware that handles audit trail operations
 */
export declare class AuditMiddleware {
    private options;
    constructor(options?: AuditOptions);
    /**
     * Apply audit information to entity
     */
    applyAudit(context: AuditContext): Promise<void>;
    /**
     * Apply created audit fields
     */
    private applyCreatedAudit;
    /**
     * Apply updated audit fields
     */
    private applyUpdatedAudit;
    /**
     * Check if entity has a property
     */
    private hasProperty;
    /**
     * Get current user ID
     */
    private getCurrentUserId;
}
//# sourceMappingURL=AuditMiddleware.d.ts.map