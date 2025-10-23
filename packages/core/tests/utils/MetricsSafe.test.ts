import {
  safeCache,
  safeCacheSize,
  safeCacheEvicted,
  warnIfLoggerDebug
} from '../../src/utils/MetricsSafe';

describe('MetricsSafe', () => {
  const origEnv = process.env;
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...origEnv };
  });
  afterAll(() => {
    process.env = origEnv;
  });

  test('safeCache calls logger.cache if exists', () => {
    const cache = vi.fn();
    safeCache({ cache } as any, { cache: 'count', hit: true });
    expect(cache).toHaveBeenCalledWith({ cache: 'count', hit: true });
  });

  test('safeCacheSize calls logger.cacheSize if exists', () => {
    const cacheSize = vi.fn();
    safeCacheSize({ cacheSize } as any, { cache: 'entityL2', size: 1 });
    expect(cacheSize).toHaveBeenCalledWith({ cache: 'entityL2', size: 1 });
  });

  test('safeCacheEvicted calls logger.cacheEvicted if exists', () => {
    const cacheEvicted = vi.fn();
    safeCacheEvicted({ cacheEvicted } as any, { cache: 'sqlGen' });
    expect(cacheEvicted).toHaveBeenCalledWith({ cache: 'sqlGen' });
  });

  test('warnIfLoggerDebug emits console.warn when flag set', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined as any);
    process.env.TSL_LOGGER_DEBUG = 'true';
    warnIfLoggerDebug('m', new Error('x'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
