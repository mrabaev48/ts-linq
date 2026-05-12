import type { AuditOptions } from './types';
/**
 * Helper to create audit options
 */
export declare function withAudit(options?: Partial<AuditOptions>): AuditOptions;
/**
 * Get audit trail information from entity
 */
export declare function getAuditInfo(entity: Record<string, unknown>, options?: Partial<AuditOptions>): {
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: string | number;
    updatedBy?: string | number;
};
/**
 * Check if entity has been modified (updatedAt > createdAt)
 */
export declare function hasBeenModified(entity: Record<string, unknown>, options?: Partial<AuditOptions>): boolean;
/**
 * Get time since last update in milliseconds
 */
export declare function timeSinceUpdate(entity: Record<string, unknown>, options?: Partial<AuditOptions>): number | null;
//# sourceMappingURL=utils.d.ts.map