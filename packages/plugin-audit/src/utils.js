"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAudit = withAudit;
exports.getAuditInfo = getAuditInfo;
exports.hasBeenModified = hasBeenModified;
exports.timeSinceUpdate = timeSinceUpdate;
/**
 * Helper to create audit options
 */
function withAudit(options = {}) {
    return {
        enabled: true,
        createdAtColumn: 'createdAt',
        updatedAtColumn: 'updatedAt',
        createdByColumn: 'createdBy',
        updatedByColumn: 'updatedBy',
        ...options
    };
}
/**
 * Get audit trail information from entity
 */
function getAuditInfo(entity, options = {}) {
    const createdAtCol = options.createdAtColumn || 'createdAt';
    const updatedAtCol = options.updatedAtColumn || 'updatedAt';
    const createdByCol = options.createdByColumn || 'createdBy';
    const updatedByCol = options.updatedByColumn || 'updatedBy';
    return {
        createdAt: entity[createdAtCol],
        updatedAt: entity[updatedAtCol],
        createdBy: entity[createdByCol],
        updatedBy: entity[updatedByCol]
    };
}
/**
 * Check if entity has been modified (updatedAt > createdAt)
 */
function hasBeenModified(entity, options = {}) {
    const auditInfo = getAuditInfo(entity, options);
    if (!auditInfo.createdAt || !auditInfo.updatedAt) {
        return false;
    }
    return auditInfo.updatedAt.getTime() > auditInfo.createdAt.getTime();
}
/**
 * Get time since last update in milliseconds
 */
function timeSinceUpdate(entity, options = {}) {
    const auditInfo = getAuditInfo(entity, options);
    if (!auditInfo.updatedAt) {
        return null;
    }
    return Date.now() - auditInfo.updatedAt.getTime();
}
//# sourceMappingURL=utils.js.map