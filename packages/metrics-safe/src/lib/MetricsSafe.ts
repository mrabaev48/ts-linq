function debugEnabled(): boolean {
  try {
    const env = (process as unknown as { env?: Record<string, string | undefined> }).env;
    const v = env?.TSL_METRICS_DEBUG;
    return v === '1' || v === 'true' || v === 'on';
  } catch {
    return false;
  }
}

function tryInvoke(
  logger: unknown,
  method: 'cache' | 'cacheSize' | 'cacheEvicted',
  payload: unknown
): void {
  try {
    const maybeMethod = (logger as Record<string, unknown> | undefined)?.[method] as
      | ((arg: unknown) => void)
      | undefined;
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

export function safeCache(
  logger: unknown,
  payload: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    hit: boolean;
    provider?: string;
    ttl?: boolean;
  }
): void {
  tryInvoke(logger, 'cache', payload);
}

export function safeCacheSize(
  logger: unknown,
  payload: { cache: 'sqlGen' | 'entityL2' | 'count'; size: number; provider?: string }
): void {
  tryInvoke(logger, 'cacheSize', payload);
}

export function safeCacheEvicted(
  logger: unknown,
  payload: { cache: 'sqlGen' | 'entityL2' | 'count'; provider?: string }
): void {
  tryInvoke(logger, 'cacheEvicted', payload);
}

export function warnIfLoggerDebug(method: string, error: unknown): void {
  try {
    const env = (process as unknown as { env?: Record<string, string | undefined> }).env;
    const debug = env?.TSL_LOGGER_DEBUG;
    if (debug === '1' || debug === 'true' || debug === 'on') {
      // eslint-disable-next-line no-console
      console.warn('[ts-linq logger]', method, error);
    }
  } catch {
    /* ignore */
  }
}
