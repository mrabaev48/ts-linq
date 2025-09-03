/*
 * Safe wrappers around optional metrics logger methods.
 * If TSL_METRICS_DEBUG is set (truthy), errors will be logged to console.warn.
 */

function debugEnabled(): boolean {
  try {
    const v = (process as any)?.env?.TSL_METRICS_DEBUG;
    return v === '1' || v === 'true' || v === 'on';
  } catch {
    return false;
  }
}

export function safeMetric(
  logger: any,
  method: 'cache' | 'cacheSize' | 'cacheEvicted',
  payload: any
): void {
  try {
    logger?.[method]?.(payload);
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

export function safeCache(logger: any, payload: any): void {
  safeMetric(logger, 'cache', payload);
}

export function safeCacheSize(logger: any, payload: any): void {
  safeMetric(logger, 'cacheSize', payload);
}

export function safeCacheEvicted(logger: any, payload: any): void {
  safeMetric(logger, 'cacheEvicted', payload);
}


