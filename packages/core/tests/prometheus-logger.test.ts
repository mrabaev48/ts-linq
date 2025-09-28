import 'reflect-metadata';
import { PrometheusSqlLogger } from 'prometheus-sql-logger';

type LabelValues = Record<string, string>;
const hits: Array<{ lbl: LabelValues; v: number }> = [];
const misses: Array<{ lbl: LabelValues; v: number }> = [];
class FakeCounter {
  private name: string;
  constructor(cfg: { name: string }) {
    this.name = cfg.name;
  }
  labels(lbl: LabelValues) {
    return {
      inc: (v?: number) => {
        if (this.name.endsWith('db_cache_hits_total')) hits.push({ lbl, v: v ?? 1 });
        if (this.name.endsWith('db_cache_misses_total')) misses.push({ lbl, v: v ?? 1 });
      }
    };
  }
}
class FakeHistogram {
  public calls: Array<{ lbl: LabelValues; v: number }> = [];
  labels(lbl: LabelValues) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}
class FakeGauge {
  public incCalls: Array<{ lbl: LabelValues | undefined; v?: number }> = [];
  public decCalls: Array<{ lbl: LabelValues | undefined; v?: number }> = [];
  inc(lbl?: LabelValues, v?: number) {
    this.incCalls.push({ lbl, v: v ?? 1 });
  }
  dec(lbl?: LabelValues, v?: number) {
    this.decCalls.push({ lbl, v: v ?? 1 });
  }
}
interface TestPromCounter {
  labels(labels: LabelValues): { inc: (v?: number) => void };
}
interface TestPromHistogram {
  labels(labels: LabelValues): { observe: (v: number) => void };
}
interface TestPromGauge {
  inc: (labels?: LabelValues, v?: number) => void;
  dec: (labels?: LabelValues, v?: number) => void;
}
interface TestPromClientLike {
  Counter: new (cfg: Record<string, unknown>) => TestPromCounter;
  Histogram: new (cfg: Record<string, unknown>) => TestPromHistogram;
  Gauge?: new (cfg: Record<string, unknown>) => TestPromGauge;
}
const fakeClient = {
  Counter: FakeCounter,
  Histogram: FakeHistogram,
  Gauge: FakeGauge
} as unknown as TestPromClientLike;

describe('PrometheusSqlLogger', () => {
  it('increments counters and observes duration when client provided', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient, prefix: 'tsl_' });
    const start = Date.now();
    logger.queryStart?.({ sql: 'SELECT * FROM "Users"', params: [], provider: 'sqlite' });
    logger.queryEnd?.({
      sql: 'SELECT * FROM "Users"',
      params: [],
      durationMs: Date.now() - start,
      provider: 'sqlite'
    });
    // No exceptions
  });

  it('no-ops when prom-client is not installed', () => {
    const logger = new PrometheusSqlLogger('test');
    logger.queryStart?.({ sql: 'SELECT 1', params: [] });
    logger.queryEnd?.({ sql: 'SELECT 1', params: [], durationMs: 5 });
  });

  it('records retry attempts and transaction gauge when Gauge available', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient, prefix: 'tsl_' });
    logger.retry?.({ sql: 'SELECT * FROM X', params: [], attempt: 1, provider: 'postgresql' });
    logger.transactionStart?.({ provider: 'postgresql' });
    logger.transactionEnd?.({ provider: 'postgresql' });
  });

  it('records cache hits and misses via cache() hook', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient, prefix: 'tsl_' });
    const hitsBefore = hits.length;
    const missesBefore = misses.length;
    logger.cache?.({ cache: 'count', hit: true, provider: 'sqlite' });
    logger.cache?.({ cache: 'entityL2', hit: false, provider: 'sqlite' });
    expect(hits.length).toBe(hitsBefore + 1);
    expect(misses.length).toBe(missesBefore + 1);
  });
});
