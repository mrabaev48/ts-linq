"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeSqlLogger = void 0;
class CompositeSqlLogger {
    constructor(...delegates) {
        this.delegates = delegates.filter(Boolean);
    }
    queryStart(info) {
        for (const d of this.delegates) {
            try {
                d.queryStart?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    queryEnd(info) {
        for (const d of this.delegates) {
            try {
                d.queryEnd?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    retry(info) {
        for (const d of this.delegates) {
            try {
                d.retry?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    transactionStart(info) {
        for (const d of this.delegates) {
            try {
                d.transactionStart?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    transactionEnd(info) {
        for (const d of this.delegates) {
            try {
                d.transactionEnd?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    cache(info) {
        for (const d of this.delegates) {
            try {
                d.cache?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    connectionHealth(info) {
        for (const d of this.delegates) {
            try {
                d.connectionHealth?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    circuit(info) {
        for (const d of this.delegates) {
            try {
                d.circuit?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    fallback(info) {
        for (const d of this.delegates) {
            try {
                d.fallback?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
    hedgedWin(info) {
        for (const d of this.delegates) {
            try {
                d.hedgedWin?.(info);
            }
            catch {
                /* swallow */
            }
        }
    }
}
exports.CompositeSqlLogger = CompositeSqlLogger;
//# sourceMappingURL=CompositeSqlLogger.js.map