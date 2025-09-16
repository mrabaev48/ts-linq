"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeSqlLogger = void 0;
/**
 * Composite logger that fan-outs all SqlLogger calls to a list of delegates.
 * Each delegate is called in order; errors are swallowed to avoid impacting
 * query execution flow.
 */
class CompositeSqlLogger {
    constructor(...delegates) {
        this.delegates = delegates.filter(Boolean);
    }
    queryStart(info) {
        for (const delegate of this.delegates) {
            try {
                delegate.queryStart?.(info);
            }
            catch (e) {
                const { warnIfLoggerDebug } = require('./MetricsSafe');
                warnIfLoggerDebug('queryStart', e);
            }
        }
    }
    queryEnd(info) {
        for (const delegate of this.delegates) {
            try {
                delegate.queryEnd?.(info);
            }
            catch (e) {
                const { warnIfLoggerDebug } = require('./MetricsSafe');
                warnIfLoggerDebug('queryEnd', e);
            }
        }
    }
    retry(info) {
        for (const delegate of this.delegates) {
            try {
                delegate.retry?.(info);
            }
            catch (e) {
                const { warnIfLoggerDebug } = require('./MetricsSafe');
                warnIfLoggerDebug('retry', e);
            }
        }
    }
    transactionStart(info) {
        for (const delegate of this.delegates) {
            try {
                delegate.transactionStart?.(info);
            }
            catch (e) {
                const { warnIfLoggerDebug } = require('./MetricsSafe');
                warnIfLoggerDebug('transactionStart', e);
            }
        }
    }
    transactionEnd(info) {
        for (const delegate of this.delegates) {
            try {
                delegate.transactionEnd?.(info);
            }
            catch (e) {
                const { warnIfLoggerDebug } = require('./MetricsSafe');
                warnIfLoggerDebug('transactionEnd', e);
            }
        }
    }
    cache(info) {
        for (const delegate of this.delegates) {
            try {
                delegate.cache?.(info);
            }
            catch (e) {
                const { warnIfLoggerDebug } = require('./MetricsSafe');
                warnIfLoggerDebug('cache', e);
            }
        }
    }
}
exports.CompositeSqlLogger = CompositeSqlLogger;
//# sourceMappingURL=CompositeSqlLogger.js.map