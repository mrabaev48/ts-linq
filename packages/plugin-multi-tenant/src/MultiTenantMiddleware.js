"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiTenantMiddleware = void 0;
const metadata_1 = require("@ts-linq/metadata");
/**
 * Middleware that handles multi-tenant operations
 */
class MultiTenantMiddleware {
    constructor(options = {}) {
        this.options = {
            enabled: true,
            tenantIdColumn: 'tenantId',
            isolate: true,
            strictMode: true,
            ...options
        };
    }
    /**
     * Set current tenant ID
     */
    setTenant(tenantId) {
        this.currentTenant = tenantId;
    }
    /**
     * Get current tenant ID
     */
    async getTenant() {
        if (this.currentTenant !== undefined) {
            return this.currentTenant;
        }
        if (this.options.getCurrentTenant) {
            try {
                return await Promise.resolve(this.options.getCurrentTenant());
            }
            catch {
                return undefined;
            }
        }
        return undefined;
    }
    /**
     * Apply tenant ID to entity
     */
    async applyTenant(context) {
        if (!this.options.enabled) {
            return;
        }
        const meta = metadata_1.MetadataStorage.getEntity(context.entityClass);
        if (!meta) {
            return;
        }
        const tenantColumn = this.options.tenantIdColumn;
        // Check if entity has tenant column
        const hasTenantColumn = meta.columns.some((c) => c.propertyName === tenantColumn || c.columnName === tenantColumn);
        if (!hasTenantColumn) {
            return;
        }
        const tenantId = context.tenantId ?? await this.getTenant();
        if (this.options.strictMode && tenantId === undefined) {
            throw new Error('No tenant context available. Set tenant using setTenant() or getCurrentTenant()');
        }
        if (context.operation === 'insert' || context.operation === 'update') {
            context.entity[tenantColumn] = tenantId;
        }
    }
    /**
     * Get filter condition for tenant isolation
     */
    async getFilterCondition() {
        if (!this.options.enabled || !this.options.isolate) {
            return null;
        }
        const tenantId = await this.getTenant();
        if (tenantId === undefined) {
            if (this.options.strictMode) {
                throw new Error('No tenant context available for query filtering');
            }
            return null;
        }
        const column = this.options.tenantIdColumn;
        const value = typeof tenantId === 'string' ? `'${tenantId}'` : tenantId;
        return `${column} = ${value}`;
    }
    /**
     * Check if entity belongs to current tenant
     */
    async belongsToTenant(entity) {
        const tenantColumn = this.options.tenantIdColumn;
        const entityTenantId = entity[tenantColumn];
        const currentTenantId = await this.getTenant();
        return entityTenantId === currentTenantId;
    }
    /**
     * Clear current tenant
     */
    clearTenant() {
        this.currentTenant = undefined;
    }
}
exports.MultiTenantMiddleware = MultiTenantMiddleware;
//# sourceMappingURL=MultiTenantMiddleware.js.map