"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachePolicy = CachePolicy;
/**
 * Class decorator to declare cache invalidation dependencies for an entity.
 * Stores metadata under key 'orm:cachePolicy'.
 */
function CachePolicy(options) {
    return (target) => {
        try {
            Reflect.defineMetadata?.('orm:cachePolicy', { ...options }, target);
        }
        catch {
            // no-op if Reflect metadata not available
        }
    };
}
//# sourceMappingURL=CachePolicy.js.map