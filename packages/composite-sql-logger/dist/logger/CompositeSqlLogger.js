"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeSqlLogger = void 0;
class CompositeSqlLogger {
    constructor(...delegates) {
        this.delegates = delegates.filter(Boolean);
    }
    debug(message, meta) {
        for (const d of this.delegates) {
            try {
                d.debug(message, meta);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] debug delegate error', e);
            }
        }
    }
    info(message, meta) {
        for (const d of this.delegates) {
            try {
                d.info(message, meta);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] info delegate error', e);
            }
        }
    }
    warn(message, meta) {
        for (const d of this.delegates) {
            try {
                d.warn(message, meta);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] warn delegate error', e);
            }
        }
    }
    error(message, meta) {
        for (const d of this.delegates) {
            try {
                d.error(message, meta);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] error delegate error', e);
            }
        }
    }
    queryStart(info) {
        for (const d of this.delegates) {
            try {
                d.queryStart?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] queryStart delegate error', e);
            }
        }
    }
    queryEnd(info) {
        for (const d of this.delegates) {
            try {
                d.queryEnd?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] queryEnd delegate error', e);
            }
        }
    }
    retry(info) {
        for (const d of this.delegates) {
            try {
                d.retry?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] retry delegate error', e);
            }
        }
    }
    transactionStart(info) {
        for (const d of this.delegates) {
            try {
                d.transactionStart?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] transactionStart delegate error', e);
            }
        }
    }
    transactionEnd(info) {
        for (const d of this.delegates) {
            try {
                d.transactionEnd?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] transactionEnd delegate error', e);
            }
        }
    }
    cache(info) {
        for (const d of this.delegates) {
            try {
                d.cache?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] cache delegate error', e);
            }
        }
    }
    connectionHealth(info) {
        for (const d of this.delegates) {
            try {
                d.connectionHealth?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] connectionHealth delegate error', e);
            }
        }
    }
    circuit(info) {
        for (const d of this.delegates) {
            try {
                d.circuit?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] circuit delegate error', e);
            }
        }
    }
    fallback(info) {
        for (const d of this.delegates) {
            try {
                d.fallback?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] fallback delegate error', e);
            }
        }
    }
    hedgedWin(info) {
        for (const d of this.delegates) {
            try {
                d.hedgedWin?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] hedgedWin delegate error', e);
            }
        }
    }
    analysis(info) {
        for (const d of this.delegates) {
            try {
                d.analysis?.(info);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[CompositeSqlLogger] analysis delegate error', e);
            }
        }
    }
}
exports.CompositeSqlLogger = CompositeSqlLogger;
//# sourceMappingURL=CompositeSqlLogger.js.map