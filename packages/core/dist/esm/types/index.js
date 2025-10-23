// Re-export types from @ts-linq/types and @ts-linq/metadata for backwards compatibility
export * from '@ts-linq/types';
/**
 * Core-specific types that don't belong in @ts-linq/types
 */
/** Entity state for change tracking */
export var EntityState;
(function (EntityState) {
    EntityState["Unchanged"] = "unchanged";
    EntityState["Added"] = "added";
    EntityState["Modified"] = "modified";
    EntityState["Deleted"] = "deleted";
})(EntityState || (EntityState = {}));
// Re-export metadata types for backwards compatibility  
export { MetadataStorage } from '@ts-linq/metadata';
export class CircuitOpenError extends Error {
    constructor(message = 'Circuit is open; call short-circuited') {
        super(message);
        this.name = 'CircuitOpenError';
    }
}
//# sourceMappingURL=index.js.map