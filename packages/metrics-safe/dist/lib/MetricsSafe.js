'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.safeCache = safeCache;
exports.safeCacheSize = safeCacheSize;
exports.safeCacheEvicted = safeCacheEvicted;
exports.warnIfLoggerDebug = warnIfLoggerDebug;
function debugEnabled() {
  try {
    const env = process.env;
    const v = env?.TSL_METRICS_DEBUG;
    return v === '1' || v === 'true' || v === 'on';
  } catch {
    return false;
  }
}
function tryInvoke(logger, method, payload) {
  try {
    const maybeMethod = logger?.[method];
    maybeMethod?.(payload);
  } catch (e) {
    if (debugEnabled()) {
      try {
        // eslint-disable-next-line no-console
        console.warn('[ts-linq metrics]', method, e);
      } catch {
        /* ignore */
      }
    }
  }
}
function safeCache(logger, payload) {
  tryInvoke(logger, 'cache', payload);
}
function safeCacheSize(logger, payload) {
  tryInvoke(logger, 'cacheSize', payload);
}
function safeCacheEvicted(logger, payload) {
  tryInvoke(logger, 'cacheEvicted', payload);
}
function warnIfLoggerDebug(method, error) {
  try {
    const env = process.env;
    const debug = env?.TSL_LOGGER_DEBUG;
    if (debug === '1' || debug === 'true' || debug === 'on') {
      // eslint-disable-next-line no-console
      console.warn('[ts-linq logger]', method, error);
    }
  } catch {
    /* ignore */
  }
}
//# sourceMappingURL=MetricsSafe.js.map
