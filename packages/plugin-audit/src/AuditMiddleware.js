"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditMiddleware = void 0;
const metadata_1 = require("@ts-linq/metadata");
/**
 * Middleware that handles audit trail operations
 */
class AuditMiddleware {
    constructor(options = {}) {
        this.options = {
            enabled: true,
            createdAtColumn: 'createdAt',
            updatedAtColumn: 'updatedAt',
            createdByColumn: 'createdBy',
            updatedByColumn: 'updatedBy',
            ...options
        };
    }
    /**
     * Apply audit information to entity
     */
    async applyAudit(context) {
        if (!this.options.enabled) {
            return;
        }
        const meta = metadata_1.MetadataStorage.getEntity(context.entityClass);
        if (!meta) {
            return;
        }
        const now = context.timestamp || (this.options.clock?.() ?? new Date());
        const currentUser = context.currentUser ?? (await this.getCurrentUserId());
        if (context.state === 'added') {
            this.applyCreatedAudit(meta, context.entity, now, currentUser);
        }
        if (context.state === 'added' || context.state === 'modified') {
            this.applyUpdatedAudit(meta, context.entity, now, currentUser);
        }
    }
    /**
     * Apply created audit fields
     */
    applyCreatedAudit(meta, entity, now, currentUser) {
        const createdAtCol = this.options.timeColumns?.createdAt || this.options.createdAtColumn;
        const createdByCol = this.options.userColumns?.createdBy || this.options.createdByColumn;
        if (this.hasProperty(meta, createdAtCol)) {
            entity[createdAtCol] = now;
        }
        if (this.hasProperty(meta, createdByCol) && currentUser !== undefined) {
            entity[createdByCol] = currentUser;
        }
    }
    /**
     * Apply updated audit fields
     */
    applyUpdatedAudit(meta, entity, now, currentUser) {
        const updatedAtCol = this.options.timeColumns?.updatedAt || this.options.updatedAtColumn;
        const updatedByCol = this.options.userColumns?.updatedBy || this.options.updatedByColumn;
        if (this.hasProperty(meta, updatedAtCol)) {
            entity[updatedAtCol] = now;
        }
        if (this.hasProperty(meta, updatedByCol) && currentUser !== undefined) {
            entity[updatedByCol] = currentUser;
        }
    }
    /**
     * Check if entity has a property
     */
    hasProperty(meta, propertyName) {
        return meta.columns.some((c) => c.propertyName === propertyName || c.columnName === propertyName);
    }
    /**
     * Get current user ID
     */
    async getCurrentUserId() {
        if (!this.options.getCurrentUser) {
            return undefined;
        }
        try {
            return await Promise.resolve(this.options.getCurrentUser());
        }
        catch {
            return undefined;
        }
    }
}
exports.AuditMiddleware = AuditMiddleware;
//# sourceMappingURL=AuditMiddleware.js.map