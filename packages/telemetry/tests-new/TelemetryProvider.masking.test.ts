import { describe, expect, it } from '@jest/globals';
import { maskSql } from '@ts-linq/types';

import type { SpanLike, TracerLike } from '../src/provider/TelemetryProvider';
import { TelemetryProvider } from '../src/provider/TelemetryProvider';

function makeMockTracer(): { tracer: TracerLike; lastAttrs: Record<string, unknown> } {
  const lastAttrs: Record<string, unknown> = {};
  const spanMock: SpanLike = {
    setAttribute: (key: string, value: string | number | boolean) => {
      lastAttrs[key] = value;
    },
    recordException: () => {},
    setStatus: () => {},
    end: () => {}
  };
  const tracer: TracerLike = {
    startSpan: (_name: string, opts?: { attributes?: Record<string, unknown> }) => {
      if (opts?.attributes) {
        for (const [k, v] of Object.entries(opts.attributes)) {
          lastAttrs[k] = v;
        }
      }
      return spanMock;
    }
  };
  return { tracer, lastAttrs };
}

const INPUT = `SELECT * FROM users WHERE name = 'alice' AND tag = "secret-tag" AND id = 7`;
const PATTERNS = [/\b\d+\b/g];

describe('TelemetryProvider — SQL masking', () => {
  it('emits db.statement equal to the canonical maskSql() output', () => {
    const { tracer, lastAttrs } = makeMockTracer();
    const provider = new TelemetryProvider({ tracer, maskSql: true, maskPatterns: PATTERNS });

    provider.queryStart({ sql: INPUT, params: [], traceId: 't1', provider: 'pg' });

    expect(lastAttrs['db.statement']).toBe(maskSql(INPUT, PATTERNS));
  });

  it('does not leak a known secret literal into db.statement', () => {
    const { tracer, lastAttrs } = makeMockTracer();
    const provider = new TelemetryProvider({ tracer, maskSql: true });
    const secret = 'super-secret-pw';

    provider.queryStart({
      sql: `UPDATE creds SET pw = '${secret}'`,
      params: [],
      traceId: 't2',
      provider: 'pg'
    });

    expect(String(lastAttrs['db.statement'])).not.toContain(secret);
  });

  it('leaves db.statement untouched when masking is disabled', () => {
    const { tracer, lastAttrs } = makeMockTracer();
    const provider = new TelemetryProvider({ tracer });

    provider.queryStart({ sql: INPUT, params: [], traceId: 't3', provider: 'pg' });

    expect(lastAttrs['db.statement']).toBe(INPUT);
  });
});
