"use strict";
// Core-specific types only - NO re-exports from other packages
// Consumers should import directly from @ts-linq/types when needed
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitOpenError = exports.EntityState = void 0;
/**
 * Core-specific types that don't belong in @ts-linq/types
 */
/** Entity state for change tracking */
var EntityState;
(function (EntityState) {
    EntityState["Unchanged"] = "unchanged";
    EntityState["Added"] = "added";
    EntityState["Modified"] = "modified";
    EntityState["Deleted"] = "deleted";
})(EntityState || (exports.EntityState = EntityState = {}));
class CircuitOpenError extends Error {
    constructor(message = 'Circuit is open; call short-circuited') {
        super(message);
        this.name = 'CircuitOpenError';
    }
}
exports.CircuitOpenError = CircuitOpenError;
//# sourceMappingURL=index.js.map