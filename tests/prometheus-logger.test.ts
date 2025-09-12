import 'reflect-metadata';
import { PrometheusSqlLogger } from '../src/utils/PrometheusSqlLogger';

const hits: Array<{ lbl: unknown; v: number }> = [];
const misses: Array<{ lbl: unknown; v: number }> = [];
class FakeCounter {
  private name: string;
  constructor(cfg: { name: string }) {
    this.name = cfg.name;
  }
  labels(lbl: unknown) {
    return {
      inc: (v?: number) => {
        if (this.name.endsWith('db_cache_hits_total')) hits.push({ lbl, v: v ?? 1 });
        if (this.name.endsWith('db_cache_misses_total')) misses.push({ lbl, v: v ?? 1 });
      }
    };
  }
}
class FakeHistogram {
  public calls: Array<{ lbl: unknown; v: number }> = [];
  labels(lbl: unknown) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}
class FakeGauge {
  public incCalls: Array<{ lbl: unknown; v?: number }> = [];
  public decCalls: Array<{ lbl: unknown; v?: number }> = [];
  inc(lbl?: unknown, v?: number) {
    this.incCalls.push({ lbl, v: v ?? 1 });
  }
  dec(lbl?: unknown, v?: number) {
    this.decCalls.push({ lbl, v: v ?? 1 });
  }
}
const fakeClient = {
  Counter: FakeCounter as unknown as typeof FakeCounter,
  Histogram: FakeHistogram as unknown as typeof FakeHistogram,
  Gauge: FakeGauge as unknown as typeof FakeGauge
};

describe('PrometheusSqlLogger', () => {
  it('increments counters and observes duration when client provided', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient as any, prefix: 'tsl_' });
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
    const logger = new PrometheusSqlLogger('test', { client: fakeClient as any, prefix: 'tsl_' });
    logger.retry?.({ sql: 'SELECT * FROM X', params: [], attempt: 1, provider: 'postgresql' });
    logger.transactionStart?.({ provider: 'postgresql' });
    logger.transactionEnd?.({ provider: 'postgresql' });
  });

  it('records cache hits and misses via cache() hook', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient as any, prefix: 'tsl_' });
    const hitsBefore = hits.length;
    const missesBefore = misses.length;
    logger.cache?.({ cache: 'count', hit: true, provider: 'sqlite' });
    logger.cache?.({ cache: 'entityL2', hit: false, provider: 'sqlite' });
    expect(hits.length).toBe(hitsBefore + 1);
    expect(misses.length).toBe(missesBefore + 1);
  });
});
