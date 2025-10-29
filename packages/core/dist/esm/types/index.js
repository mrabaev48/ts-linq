// Core-specific types only - NO re-exports from other packages
// Consumers should import directly from @ts-linq/types when needed
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
export class CircuitOpenError extends Error {
    constructor(message = 'Circuit is open; call short-circuited') {
        super(message);
        this.name = 'CircuitOpenError';
    }
}
//# sourceMappingURL=index.js.map