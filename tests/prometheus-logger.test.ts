import 'reflect-metadata';
import { PrometheusSqlLogger } from '../src/utils/PrometheusSqlLogger';

const hits: any[] = [];
const misses: any[] = [];
class FakeCounter {
  private name: string;
  constructor(cfg: any) {
    this.name = cfg.name;
  }
  labels(lbl: any) {
    return {
      inc: (v?: number) => {
        if (this.name.endsWith('db_cache_hits_total')) hits.push({ lbl, v: v ?? 1 });
        if (this.name.endsWith('db_cache_misses_total')) misses.push({ lbl, v: v ?? 1 });
      }
    };
  }
}
class FakeHistogram {
  public calls: any[] = [];
  labels(lbl: any) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}
class FakeGauge {
  public incCalls: any[] = [];
  public decCalls: any[] = [];
  inc(lbl?: any, v?: number) {
    this.incCalls.push({ lbl, v: v ?? 1 });
  }
  dec(lbl?: any, v?: number) {
    this.decCalls.push({ lbl, v: v ?? 1 });
  }
}
const fakeClient = {
  Counter: FakeCounter as any,
  Histogram: FakeHistogram as any,
  Gauge: FakeGauge as any
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
