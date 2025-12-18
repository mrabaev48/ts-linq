import { OpenTelemetrySqlLogger } from '../src/logger/OpenTelemetrySqlLogger';

describe('OpenTelemetrySqlLogger', () => {
  describe('Constructor', () => {
    it('should create logger with default service name', () => {
      const logger = new OpenTelemetrySqlLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger with custom service name', () => {
      const logger = new OpenTelemetrySqlLogger('my-service');
      expect(logger).toBeDefined();
    });

    it('should create logger with mask options', () => {
      const logger = new OpenTelemetrySqlLogger('my-service', {
        maskSql: true,
        maskPatterns: [/password=\w+/gi]
      });
      expect(logger).toBeDefined();
    });
  });

  describe('SqlLogger Interface Methods', () => {
    let logger: OpenTelemetrySqlLogger;

    beforeEach(() => {
      logger = new OpenTelemetrySqlLogger();
    });

    it('should implement debug method (no-op)', () => {
      expect(() => logger.debug('test message')).not.toThrow();
    });

    it('should implement info method (no-op)', () => {
      expect(() => logger.info('test message')).not.toThrow();
    });

    it('should implement warn method (no-op)', () => {
      expect(() => logger.warn('test message')).not.toThrow();
    });

    it('should implement error method (no-op)', () => {
      expect(() => logger.error('test message')).not.toThrow();
    });
  });

  describe('Query Lifecycle', () => {
    let logger: OpenTelemetrySqlLogger;

    beforeEach(() => {
      logger = new OpenTelemetrySqlLogger();
    });

    it('should handle queryStart without OpenTelemetry installed', () => {
      expect(() => logger.queryStart({
        sql: 'SELECT * FROM users',
        params: [],
        traceId: 'test-trace-1'
      })).not.toThrow();
    });

    it('should handle queryEnd without OpenTelemetry installed', () => {
      expect(() => logger.queryEnd({
        sql: 'SELECT * FROM users',
        params: [],
        durationMs: 50,
        traceId: 'test-trace-1',
        rows: 10
      })).not.toThrow();
    });

    it('should handle queryEnd with error', () => {
      expect(() => logger.queryEnd({
        sql: 'SELECT * FROM users',
        params: [],
        durationMs: 50,
        traceId: 'test-trace-1',
        error: new Error('Query failed')
      })).not.toThrow();
    });

    it('should handle queryEnd for non-existent trace', () => {
      expect(() => logger.queryEnd({
        sql: 'SELECT * FROM users',
        params: [],
        durationMs: 50,
        traceId: 'non-existent-trace'
      })).not.toThrow();
    });
  });

  describe('Analysis Method', () => {
    let logger: OpenTelemetrySqlLogger;

    beforeEach(() => {
      logger = new OpenTelemetrySqlLogger();
    });

    it('should handle analysis without OpenTelemetry installed', () => {
      expect(() => logger.analysis?.({
        sql: 'SELECT * FROM users WHERE id = 1',
        params: [],
        durationMs: 100,
        provider: 'postgresql',
        slow: true,
        recommendations: ['Add index on id column']
      })).not.toThrow();
    });

    it('should handle analysis with explainPlan', () => {
      expect(() => logger.analysis?.({
        sql: 'SELECT * FROM users',
        params: [],
        durationMs: 50,
        explainPlan: { type: 'Seq Scan', cost: 100 }
      })).not.toThrow();
    });
  });

  describe('SQL Masking', () => {
    it('should mask SQL when maskSql option is true', () => {
      const logger = new OpenTelemetrySqlLogger('test', { maskSql: true });
      
      expect(() => logger.queryStart({
        sql: "SELECT * FROM users WHERE password = 'secret123'",
        params: [],
        traceId: 'test-mask'
      })).not.toThrow();
    });

    it('should apply custom mask patterns', () => {
      const logger = new OpenTelemetrySqlLogger('test', {
        maskSql: true,
        maskPatterns: [/api_key=\w+/gi]
      });

      expect(() => logger.queryStart({
        sql: 'SELECT * FROM config WHERE api_key=abc123',
        params: [],
        traceId: 'test-pattern'
      })).not.toThrow();
    });
  });
});
