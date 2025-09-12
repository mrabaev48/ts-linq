import 'reflect-metadata';
import { PrometheusSqlLogger } from '../src/utils/PrometheusSqlLogger';

type LabelValues = Record<string, string>;

class ExHistogram {
  public calls: Array<{ lbl: LabelValues; v: number; exemplar?: Record<string, unknown> }> = [];
  labels(lbl: LabelValues) {
    return {
      observe: (v: number, exemplar?: Record<string, unknown>) =>
        this.calls.push({ lbl, v, exemplar })
    };
  }
}
class NoExHistogram {
  public calls: Array<{ lbl: LabelValues; v: number }> = [];
  labels(lbl: LabelValues) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}
class FakeCounter {
  labels(_lbl: LabelValues) {
    return { inc: (_v?: number) => {} };
  }
}

describe('PrometheusSqlLogger exemplars', () => {
  it('passes exemplar with traceId when histogram supports it', () => {
    const fakeClient = { Counter: FakeCounter, Histogram: ExHistogram } as unknown as {
      Counter: new (cfg: Record<string, unknown>) => {
        labels: (labels: LabelValues) => { inc: (v?: number) => void };
      };
      Histogram: new (cfg: Record<string, unknown>) => {
        labels: (labels: LabelValues) => {
          observe: (v: number, exemplar?: Record<string, unknown>) => void;
        };
      };
    };
    const logger = new PrometheusSqlLogger('svc', { client: fakeClient });
    const h: ExHistogram = (logger as unknown as { queryDuration: ExHistogram }).queryDuration;
    logger.queryEnd?.({
      sql: 'SELECT 1',
      params: [],
      durationMs: 7,
      provider: 'sqlite',
      traceId: 't-123'
    });
    expect(h.calls[0].exemplar).toEqual({ traceId: 't-123' });
  });

  it('falls back without exemplar when not supported', () => {
    const fakeClient = { Counter: FakeCounter, Histogram: NoExHistogram } as unknown as {
      Counter: new (cfg: Record<string, unknown>) => {
        labels: (labels: LabelValues) => { inc: (v?: number) => void };
      };
      Histogram: new (cfg: Record<string, unknown>) => {
        labels: (labels: LabelValues) => { observe: (v: number) => void };
      };
    };
    const logger = new PrometheusSqlLogger('svc', { client: fakeClient });
    const h: NoExHistogram = (logger as unknown as { queryDuration: NoExHistogram }).queryDuration;
    logger.queryEnd?.({
      sql: 'SELECT 1',
      params: [],
      durationMs: 7,
      provider: 'sqlite',
      traceId: 't-123'
    });
    expect(h.calls[0].v).toBeGreaterThanOrEqual(0);
  });
});
