import { maskSql } from '@ts-linq/types';

const INPUT = `SELECT * FROM users WHERE name = 'alice' AND tag = "secret-tag" AND id = 7`;
const PATTERNS = [/\b\d+\b/g];

function withTracer(): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  const span = {
    setAttribute: (k: string, v: unknown) => {
      attributes[k] = v;
    },
    recordException: () => {},
    setStatus: () => {},
    end: () => {}
  };
  const tracer = {
    startSpan: (_name: string, opts?: { attributes?: Record<string, unknown> }) => {
      if (opts?.attributes) Object.assign(attributes, opts.attributes);
      return span;
    }
  };
  jest.resetModules();
  jest.doMock('@opentelemetry/api', () => ({ trace: { getTracer: () => tracer } }), {
    virtual: true
  });
  return attributes;
}

describe('OpenTelemetrySqlLogger — SQL masking', () => {
  it('emits db.statement equal to the canonical maskSql() output', () => {
    const attributes = withTracer();
    const { OpenTelemetrySqlLogger: Otel } =
      require('../src/logger/OpenTelemetrySqlLogger') as typeof import('../src/logger/OpenTelemetrySqlLogger');
    const logger = new Otel('svc', { maskSql: true, maskPatterns: PATTERNS });

    logger.queryStart({ sql: INPUT, params: [], provider: 'postgresql', traceId: 't1' });

    expect(attributes['db.statement']).toBe(maskSql(INPUT, PATTERNS));
  });

  it('does not leak a known secret literal into db.statement', () => {
    const attributes = withTracer();
    const { OpenTelemetrySqlLogger: Otel } =
      require('../src/logger/OpenTelemetrySqlLogger') as typeof import('../src/logger/OpenTelemetrySqlLogger');
    const logger = new Otel('svc', { maskSql: true });
    const secret = 'super-secret-pw';

    logger.queryStart({
      sql: `UPDATE creds SET pw = '${secret}'`,
      params: [],
      provider: 'postgresql',
      traceId: 't2'
    });

    expect(String(attributes['db.statement'])).not.toContain(secret);
  });
});
