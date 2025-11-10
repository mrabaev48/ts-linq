import { OpenTelemetrySqlLogger } from '@ts-linq/open-telemetry-sql-logger';

describe('OpenTelemetrySqlLogger', () => {
  it('does not throw when @opentelemetry/api is not installed', () => {
    const logger = new OpenTelemetrySqlLogger('test');
    expect(() => logger.queryStart({ sql: 'SELECT 1', params: [] })).not.toThrow();
    expect(() => logger.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 1 })).not.toThrow();
  });
});
