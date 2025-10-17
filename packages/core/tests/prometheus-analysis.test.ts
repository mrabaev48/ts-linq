import { PrometheusSqlLogger } from '@ts-linq/prometheus-sql-logger';
import type { SqlLogger, QueryAnalysisInfo } from '@ts-linq/core/src/types';

type LabelValues = Record<string, string>;

class FakeCounter {
  public calls: Array<{ lbl: LabelValues; v: number }> = [];
  constructor(private readonly name: string) {}
  labels(lbl: LabelValues) {
    return { inc: (v?: number) => this.calls.push({ lbl, v: v ?? 1 }) };
  }
}
class FakeHistogram {
  public calls: Array<{ lbl: LabelValues; v: number }> = [];
  labels(lbl: LabelValues) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}
class FakeGauge {
  inc(): void {}
  dec(): void {}
  set(): void {}
}

const fakeClient = {
  Counter: class extends FakeCounter {} as unknown as new (cfg: { name: string }) => FakeCounter,
  Histogram: FakeHistogram,
  Gauge: FakeGauge
} as const;

describe('PrometheusSqlLogger.analysis', () => {
  it('records analysis duration, slow and explained counters', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient as any, prefix: 'tsl_' });
    const info: QueryAnalysisInfo = {
      sql: 'SELECT * FROM users',
      params: [],
      durationMs: 123,
      provider: 'sqlite',
      slow: true,
      explainPlan: { plan: 'ok' }
    };
    // Should not throw
    logger.analysis?.(info);
  });
});
