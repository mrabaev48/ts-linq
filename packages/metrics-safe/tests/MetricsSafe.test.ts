import { safeCache, safeCacheSize, safeCacheEvicted, warnIfLoggerDebug } from '../src/lib/MetricsSafe';

describe('MetricsSafe', () => {
  const originalEnv = process.env;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleWarnSpy.mockRestore();
  });

  describe('safeCache', () => {
    it('should invoke cache method on logger', () => {
      const mockCache = jest.fn();
      const logger = { cache: mockCache };
      const payload = {
        cache: 'sqlGen' as const,
        hit: true,
        provider: 'postgresql'
      };

      safeCache(logger, payload);

      expect(mockCache).toHaveBeenCalledWith(payload);
      expect(mockCache).toHaveBeenCalledTimes(1);
    });

    it('should handle logger without cache method', () => {
      const logger = {};
      const payload = {
        cache: 'entityL2' as const,
        hit: false
      };

      expect(() => safeCache(logger, payload)).not.toThrow();
    });

    it('should handle null logger', () => {
      const payload = {
        cache: 'count' as const,
        hit: true
      };

      expect(() => safeCache(null, payload)).not.toThrow();
    });

    it('should handle undefined logger', () => {
      const payload = {
        cache: 'sqlGen' as const,
        hit: false
      };

      expect(() => safeCache(undefined, payload)).not.toThrow();
    });

    it('should catch and suppress errors in cache method', () => {
      const mockCache = jest.fn(() => {
        throw new Error('Cache method error');
      });
      const logger = { cache: mockCache };
      const payload = {
        cache: 'sqlGen' as const,
        hit: true
      };

      expect(() => safeCache(logger, payload)).not.toThrow();
    });

    it('should log warning when TSL_METRICS_DEBUG is enabled', () => {
      process.env.TSL_METRICS_DEBUG = '1';
      const mockCache = jest.fn(() => {
        throw new Error('Test error');
      });
      const logger = { cache: mockCache };
      const payload = {
        cache: 'sqlGen' as const,
        hit: true
      };

      safeCache(logger, payload);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should support all cache types', () => {
      const mockCache = jest.fn();
      const logger = { cache: mockCache };

      safeCache(logger, { cache: 'sqlGen', hit: true });
      safeCache(logger, { cache: 'entityL2', hit: false });
      safeCache(logger, { cache: 'count', hit: true });

      expect(mockCache).toHaveBeenCalledTimes(3);
    });

    it('should pass ttl parameter', () => {
      const mockCache = jest.fn();
      const logger = { cache: mockCache };
      const payload = {
        cache: 'entityL2' as const,
        hit: true,
        ttl: true
      };

      safeCache(logger, payload);

      expect(mockCache).toHaveBeenCalledWith(payload);
    });
  });

  describe('safeCacheSize', () => {
    it('should invoke cacheSize method on logger', () => {
      const mockCacheSize = jest.fn();
      const logger = { cacheSize: mockCacheSize };
      const payload = {
        cache: 'sqlGen' as const,
        size: 42,
        provider: 'postgres'
      };

      safeCacheSize(logger, payload);

      expect(mockCacheSize).toHaveBeenCalledWith(payload);
      expect(mockCacheSize).toHaveBeenCalledTimes(1);
    });

    it('should handle logger without cacheSize method', () => {
      const logger = {};
      const payload = {
        cache: 'entityL2' as const,
        size: 100
      };

      expect(() => safeCacheSize(logger, payload)).not.toThrow();
    });

    it('should handle null logger', () => {
      const payload = {
        cache: 'count' as const,
        size: 0
      };

      expect(() => safeCacheSize(null, payload)).not.toThrow();
    });

    it('should catch and suppress errors in cacheSize method', () => {
      const mockCacheSize = jest.fn(() => {
        throw new Error('CacheSize method error');
      });
      const logger = { cacheSize: mockCacheSize };
      const payload = {
        cache: 'sqlGen' as const,
        size: 50
      };

      expect(() => safeCacheSize(logger, payload)).not.toThrow();
    });

    it('should handle zero size', () => {
      const mockCacheSize = jest.fn();
      const logger = { cacheSize: mockCacheSize };
      const payload = {
        cache: 'count' as const,
        size: 0
      };

      safeCacheSize(logger, payload);

      expect(mockCacheSize).toHaveBeenCalledWith(payload);
    });

    it('should handle large size values', () => {
      const mockCacheSize = jest.fn();
      const logger = { cacheSize: mockCacheSize };
      const payload = {
        cache: 'entityL2' as const,
        size: 999999
      };

      safeCacheSize(logger, payload);

      expect(mockCacheSize).toHaveBeenCalledWith(payload);
    });
  });

  describe('safeCacheEvicted', () => {
    it('should invoke cacheEvicted method on logger', () => {
      const mockCacheEvicted = jest.fn();
      const logger = { cacheEvicted: mockCacheEvicted };
      const payload = {
        cache: 'sqlGen' as const,
        provider: 'mysql'
      };

      safeCacheEvicted(logger, payload);

      expect(mockCacheEvicted).toHaveBeenCalledWith(payload);
      expect(mockCacheEvicted).toHaveBeenCalledTimes(1);
    });

    it('should handle logger without cacheEvicted method', () => {
      const logger = {};
      const payload = {
        cache: 'entityL2' as const
      };

      expect(() => safeCacheEvicted(logger, payload)).not.toThrow();
    });

    it('should handle null logger', () => {
      const payload = {
        cache: 'count' as const
      };

      expect(() => safeCacheEvicted(null, payload)).not.toThrow();
    });

    it('should catch and suppress errors in cacheEvicted method', () => {
      const mockCacheEvicted = jest.fn(() => {
        throw new Error('CacheEvicted method error');
      });
      const logger = { cacheEvicted: mockCacheEvicted };
      const payload = {
        cache: 'sqlGen' as const
      };

      expect(() => safeCacheEvicted(logger, payload)).not.toThrow();
    });

    it('should work without provider', () => {
      const mockCacheEvicted = jest.fn();
      const logger = { cacheEvicted: mockCacheEvicted };
      const payload = {
        cache: 'count' as const
      };

      safeCacheEvicted(logger, payload);

      expect(mockCacheEvicted).toHaveBeenCalledWith(payload);
    });
  });

  describe('warnIfLoggerDebug', () => {
    it('should log warning when TSL_LOGGER_DEBUG is "1"', () => {
      process.env.TSL_LOGGER_DEBUG = '1';
      const error = new Error('Test error');

      warnIfLoggerDebug('testMethod', error);

      expect(consoleWarnSpy).toHaveBeenCalledWith('[ts-linq logger]', 'testMethod', error);
    });

    it('should log warning when TSL_LOGGER_DEBUG is "true"', () => {
      process.env.TSL_LOGGER_DEBUG = 'true';
      const error = new Error('Test error');

      warnIfLoggerDebug('testMethod', error);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log warning when TSL_LOGGER_DEBUG is "on"', () => {
      process.env.TSL_LOGGER_DEBUG = 'on';
      const error = new Error('Test error');

      warnIfLoggerDebug('testMethod', error);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should not log when TSL_LOGGER_DEBUG is not set', () => {
      delete process.env.TSL_LOGGER_DEBUG;
      const error = new Error('Test error');

      warnIfLoggerDebug('testMethod', error);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not log when TSL_LOGGER_DEBUG is "0"', () => {
      process.env.TSL_LOGGER_DEBUG = '0';
      const error = new Error('Test error');

      warnIfLoggerDebug('testMethod', error);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle non-Error objects', () => {
      process.env.TSL_LOGGER_DEBUG = '1';
      const error = 'string error';

      warnIfLoggerDebug('testMethod', error);

      expect(consoleWarnSpy).toHaveBeenCalledWith('[ts-linq logger]', 'testMethod', error);
    });

    it('should handle console.warn throwing error', () => {
      process.env.TSL_LOGGER_DEBUG = '1';
      consoleWarnSpy.mockImplementation(() => {
        throw new Error('Console.warn error');
      });

      expect(() => warnIfLoggerDebug('testMethod', new Error('Test'))).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle logger with non-function cache property', () => {
      const logger = { cache: 'not a function' };
      const payload = {
        cache: 'sqlGen' as const,
        hit: true
      };

      expect(() => safeCache(logger, payload)).not.toThrow();
    });

    it('should handle all safe methods working together', () => {
      const mockLogger = {
        cache: jest.fn(),
        cacheSize: jest.fn(),
        cacheEvicted: jest.fn()
      };

      safeCache(mockLogger, { cache: 'sqlGen', hit: true });
      safeCacheSize(mockLogger, { cache: 'sqlGen', size: 10 });
      safeCacheEvicted(mockLogger, { cache: 'sqlGen' });

      expect(mockLogger.cache).toHaveBeenCalled();
      expect(mockLogger.cacheSize).toHaveBeenCalled();
      expect(mockLogger.cacheEvicted).toHaveBeenCalled();
    });
  });
});
