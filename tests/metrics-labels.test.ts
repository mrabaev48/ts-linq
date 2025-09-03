import 'reflect-metadata';
import { PrometheusSqlLogger } from '../src/utils/PrometheusSqlLogger';

class CapturingCounter {
  public name: string;
  public calls: Array<{ lbl: any; v?: number }> = [];
  constructor(cfg: any) {
    this.name = cfg.name;
  }
  labels(lbl: any) {
    return { inc: (v?: number) => this.calls.push({ lbl, v }) };
  }
}
class CapturingHistogram {
  public name: string;
  public calls: Array<{ lbl: any; v: number }> = [];
  constructor(cfg: any) {
    this.name = cfg.name;
  }
  labels(lbl: any) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}
const fakeClient = { Counter: CapturingCounter as any, Histogram: CapturingHistogram as any };

describe('PrometheusSqlLogger labels', () => {
  it('emits provider/operation/entity/success labels', () => {
    const logger = new PrometheusSqlLogger('svc', { client: fakeClient as any, prefix: 'tsl_' });
    // @ts-ignore access test internals
    const queryTotal: CapturingCounter = (logger as any).queryTotal;
    // @ts-ignore
    const queryDuration: CapturingHistogram = (logger as any).queryDuration;
    logger.queryEnd?.({
      sql: 'SELECT * FROM "Users"',
      params: [],
      durationMs: 12,
      provider: 'postgresql'
    });
    expect(queryTotal.calls.length).toBe(1);
    expect(queryDuration.calls.length).toBe(1);
    const lbl = queryTotal.calls[0].lbl;
    expect(lbl.provider).toBe('postgresql');
    expect(lbl.operation).toBe('SELECT');
    // entity parser upper-cases SQL before extracting, then strips quotes
    expect(lbl.entity).toBe('USERS');
    expect(lbl.success).toBe('true');
  });

  it('records error_type when error present', () => {
    const logger = new PrometheusSqlLogger('svc', { client: fakeClient as any, prefix: 'tsl_' });
    // @ts-ignore
    const errorTotal: CapturingCounter = (logger as any).errorTotal;
    logger.queryEnd?.({
      sql: 'UPDATE Users SET name = $1',
      params: ['x'],
      durationMs: 5,
      provider: 'postgresql',
      error: new TypeError('boom')
    });
    expect(errorTotal.calls.length).toBe(1);
    const lbl = errorTotal.calls[0].lbl;
    expect(lbl.error_type).toBe('TypeError');
  });
});
