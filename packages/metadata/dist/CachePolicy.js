"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachePolicy = CachePolicy;
exports.getCachePolicy = getCachePolicy;
// Store cache policies per entity class
const cachePolicies = new WeakMap();
/**
 * Class decorator to declare cache invalidation dependencies for an entity.
 * Uses legacy TypeScript decorators (experimentalDecorators: true).
 */
function CachePolicy(options) {
    return function (target) {
        cachePolicies.set(target, { ...options });
        return target;
    };
}
/**
 * Get cache policy for an entity class.
 */
function getCachePolicy(target) {
    return cachePolicies.get(target);
}
//# sourceMappingURL=CachePolicy.js.map