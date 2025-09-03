import 'reflect-metadata';
import { PrometheusSqlLogger } from '../src/utils/PrometheusSqlLogger';

class ExHistogram {
  public calls: Array<{ lbl: any; v: number; exemplar?: any }> = [];
  labels(lbl: any) {
    return { observe: (v: number, exemplar?: any) => this.calls.push({ lbl, v, exemplar }) };
  }
}
class NoExHistogram {
  public calls: Array<{ lbl: any; v: number }> = [];
  labels(lbl: any) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}
class FakeCounter {
  labels(_lbl: any) {
    return { inc: (_v?: number) => {} };
  }
}

describe('PrometheusSqlLogger exemplars', () => {
  it('passes exemplar with traceId when histogram supports it', () => {
    const fakeClient = { Counter: FakeCounter as any, Histogram: ExHistogram as any };
    const logger = new PrometheusSqlLogger('svc', { client: fakeClient as any });
    // @ts-ignore
    const h: ExHistogram = (logger as any).queryDuration;
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
    const fakeClient = { Counter: FakeCounter as any, Histogram: NoExHistogram as any };
    const logger = new PrometheusSqlLogger('svc', { client: fakeClient as any });
    // @ts-ignore
    const h: NoExHistogram = (logger as any).queryDuration;
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
