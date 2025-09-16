"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeSqlLoggerFactory = void 0;
const CompositeSqlLogger_1 = require("./CompositeSqlLogger");
/**
 * Factory that composes multiple SqlLoggerFactory instances and/or direct SqlLogger providers.
 * Returns a CompositeSqlLogger of all non-empty results for a given provider.
 */
class CompositeSqlLoggerFactory {
    constructor(options = {}) {
        this.factories = options.factories ?? [];
        this.statics = options.loggers ?? [];
    }
    create(provider) {
        const delegates = [];
        for (const factory of this.factories) {
            try {
                const logger = factory?.create(provider);
                if (logger)
                    delegates.push(logger);
            }
            catch {
                /* ignore factory errors */
            }
        }
        for (const staticLogger of this.statics) {
            if (staticLogger)
                delegates.push(staticLogger);
        }
        if (delegates.length === 0)
            return undefined;
        return new CompositeSqlLogger_1.CompositeSqlLogger(...delegates);
    }
}
exports.CompositeSqlLoggerFactory = CompositeSqlLoggerFactory;
//# sourceMappingURL=CompositeSqlLoggerFactory.js.map