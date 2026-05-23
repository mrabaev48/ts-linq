import { describe, expect, it } from '@jest/globals';

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

describe('TelemetryProvider — query tags', () => {
  it('adds db.query.tags attribute when SQL has leading -- comment tags', () => {
    const { tracer, lastAttrs } = makeMockTracer();
    const provider = new TelemetryProvider({ tracer });

    const taggedSql = '-- dashboard-top-orders\n-- File: ctrl.ts:42\nSELECT 1';
    provider.queryStart({ sql: taggedSql, params: [], traceId: 'x1', provider: 'pg' });

    expect(lastAttrs['db.query.tags']).toBe(
      JSON.stringify(['dashboard-top-orders', 'File: ctrl.ts:42'])
    );
  });

  it('does not add db.query.tags when SQL has no leading comment tags', () => {
    const { tracer, lastAttrs } = makeMockTracer();
    const provider = new TelemetryProvider({ tracer });

    provider.queryStart({ sql: 'SELECT 1', params: [], traceId: 'x2', provider: 'pg' });

    expect(lastAttrs['db.query.tags']).toBeUndefined();
  });

  it('includes db.statement with the full tagged SQL', () => {
    const { tracer, lastAttrs } = makeMockTracer();
    const provider = new TelemetryProvider({ tracer });

    const taggedSql = '-- my-tag\nSELECT * FROM orders';
    provider.queryStart({ sql: taggedSql, params: [], provider: 'pg' });

    expect(lastAttrs['db.statement']).toBe(taggedSql);
  });
});
