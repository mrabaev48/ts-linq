"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachePolicy = CachePolicy;
exports.getCachePolicy = getCachePolicy;
// Store cache policies per entity class (Stage-3 compatible)
const cachePolicies = new WeakMap();
/**
 * Class decorator to declare cache invalidation dependencies for an entity.
 * Stage-3 compatible - stores metadata in WeakMap.
 */
function CachePolicy(options) {
    return function (target, context) {
        // Stage-3 path
        if (context && typeof context === 'object' && context.kind === 'class') {
            cachePolicies.set(target, { ...options });
            context.addInitializer?.(function () {
                const ctor = target;
                cachePolicies.set(ctor, { ...options });
            });
            return;
        }
        // Fail if not Stage-3
        throw new Error('@CachePolicy requires TS5 Stage-3 decorators');
    };
}
/**
 * Get cache policy for an entity class.
 */
function getCachePolicy(target) {
    return cachePolicies.get(target);
}
//# sourceMappingURL=CachePolicy.js.map