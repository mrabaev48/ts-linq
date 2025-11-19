"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTenant = withTenant;
exports.createTenantScope = createTenantScope;
exports.getTenantId = getTenantId;
exports.hasTenantColumn = hasTenantColumn;
exports.setTenantId = setTenantId;
/**
 * Helper to create multi-tenant options
 */
function withTenant(options = {}) {
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
function createTenantScope(tenantId, fn) {
    return async () => {
        // This will be used with middleware.setTenant()
        return await Promise.resolve(fn());
    };
}
/**
 * Extract tenant ID from entity
 */
function getTenantId(entity, options = {}) {
    const column = options.tenantIdColumn || 'tenantId';
    return entity[column];
}
/**
 * Check if entity has tenant column
 */
function hasTenantColumn(entity, options = {}) {
    const column = options.tenantIdColumn || 'tenantId';
    return column in entity;
}
/**
 * Set tenant ID on entity
 */
function setTenantId(entity, tenantId, options = {}) {
    const column = options.tenantIdColumn || 'tenantId';
    entity[column] = tenantId;
}
//# sourceMappingURL=utils.js.map