import 'reflect-metadata';
import { PrometheusSqlLogger } from '../src/utils/PrometheusSqlLogger';

class FakeCounter {
  public calls: any[] = [];
  labels(lbl: any) { return { inc: (v?: number) => this.calls.push({ lbl, v: v ?? 1 }) }; }
}
class FakeHistogram {
  public calls: any[] = [];
  labels(lbl: any) { return { observe: (v: number) => this.calls.push({ lbl, v }) }; }
}
const fakeClient = { Counter: FakeCounter as any, Histogram: FakeHistogram as any };

describe('PrometheusSqlLogger', () => {
  it('increments counters and observes duration when client provided', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient as any, prefix: 'tsl_' });
    const start = Date.now();
    logger.queryStart?.();
    logger.queryEnd?.({ sql: 'SELECT * FROM "Users"', params: [], durationMs: Date.now() - start });
    // No exceptions
  });

  it('no-ops when prom-client is not installed', () => {
    const logger = new PrometheusSqlLogger('test');
    logger.queryStart?.();
    logger.queryEnd?.({ sql: 'SELECT 1', params: [], durationMs: 5 });
  });
});


