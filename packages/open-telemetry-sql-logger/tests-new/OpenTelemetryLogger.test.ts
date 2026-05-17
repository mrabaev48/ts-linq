import { OpenTelemetrySqlLogger } from '../src/logger/OpenTelemetrySqlLogger';

describe('OpenTelemetrySqlLogger (tests-new)', () => {
  test('does nothing when @opentelemetry/api is not present', () => {
    const logger = new OpenTelemetrySqlLogger('svc');
    // no throw on start/end without tracer
    logger.queryStart({ sql: 'SELECT 1', params: [], provider: 'postgresql' });
    logger.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 5, provider: 'postgresql' });
  });

  test('masks SQL and sets span attributes when tracer is available', () => {
    const ended: Array<Record<string, unknown>> = [];
    const attributes: Record<string, unknown> = {};
    const spanMock = {
      setAttribute: (k: string, v: unknown) => {
        attributes[k] = v;
      },
      recordException: (_: { name: string; message: string }) => {
        attributes['exception'] = true;
      },
      setStatus: (s: { code: number; message?: string }) => {
        attributes['status'] = s;
      },
      end: () => {
        ended.push({ ...attributes });
      }
    };
    const tracerMock = {
      startSpan: (_name: string, opts?: { attributes?: Record<string, unknown> }) => {
        if (opts?.attributes) {
          for (const [k, v] of Object.entries(opts.attributes)) attributes[k] = v;
        }
        return spanMock;
      }
    };

    jest.resetModules();
    jest.doMock('@opentelemetry/api', () => ({ trace: { getTracer: () => tracerMock } }), {
      virtual: true
    });
    const { OpenTelemetrySqlLogger: Otel } =
      require('../src/logger/OpenTelemetrySqlLogger') as typeof import('../src/logger/OpenTelemetrySqlLogger');
    const logger = new Otel('svc', { maskSql: true, maskPatterns: [/users/gi] });
    logger.queryStart({
      sql: "select * from users where name = 'John'",
      params: [1],
      provider: 'postgresql',
      traceId: 't1'
    });
    logger.queryEnd({
      sql: 'ok',
      params: [],
      durationMs: 12,
      rows: 3,
      provider: 'postgresql',
      traceId: 't1'
    });

    // db.statement should be masked
    expect(String(attributes['db.statement'])).toContain('[REDACTED]');
    expect(attributes['db.system']).toBe('postgresql');
    expect(attributes['db.duration_ms']).toBe(12);
    expect(attributes['db.rows']).toBe(3);
    expect(ended.length).toBe(1);
  });

  test('records exception on error', () => {
    const set: Record<string, unknown> = {};
    const span = {
      setAttribute: (k: string, v: unknown) => {
        set[k] = v;
      },
      recordException: (e: { name: string; message: string }) => {
        set['exception'] = e.message;
      },
      setStatus: (s: { code: number; message?: string }) => {
        set['status.code'] = s.code;
      },
      end: () => {}
    };
    const tracer = { startSpan: () => span };
    jest.resetModules();
    jest.doMock('@opentelemetry/api', () => ({ trace: { getTracer: () => tracer } }), {
      virtual: true
    });
    const { OpenTelemetrySqlLogger: Otel } =
      require('../src/logger/OpenTelemetrySqlLogger') as typeof import('../src/logger/OpenTelemetrySqlLogger');
    const logger = new Otel('svc');
    logger.queryStart({ sql: 'select 1', params: [], traceId: 'x' });
    logger.queryEnd({
      sql: 'select 1',
      params: [],
      durationMs: 1,
      error: new Error('boom'),
      traceId: 'x'
    });
    expect(set['status.code']).toBe(2);
    expect(set['exception']).toBe('boom');
  });

  test('analysis creates span and attaches attributes', () => {
    const attrs: Record<string, unknown> = {};
    const span = {
      setAttribute: (k: string, v: unknown) => {
        attrs[k] = v;
      },
      recordException: () => {},
      setStatus: () => {},
      end: () => {}
    };
    const tracer = {
      startSpan: (_: string, opts?: { attributes?: Record<string, unknown> }) => {
        if (opts?.attributes) Object.assign(attrs, opts.attributes);
        return span;
      }
    };
    jest.resetModules();
    jest.doMock('@opentelemetry/api', () => ({ trace: { getTracer: () => tracer } }), {
      virtual: true
    });
    const { OpenTelemetrySqlLogger: Otel } =
      require('../src/logger/OpenTelemetrySqlLogger') as typeof import('../src/logger/OpenTelemetrySqlLogger');
    const logger = new Otel('svc');
    logger.analysis?.({
      sql: 'select',
      params: [],
      durationMs: 50,
      slow: true,
      provider: 'postgresql',
      recommendations: ['add index']
    });
    expect(attrs['db.analysis.duration_ms']).toBe(50);
    expect(attrs['db.analysis.slow']).toBe(true);
    expect(String(attrs['db.analysis.recommendations'])).toContain('add index');
  });
});
