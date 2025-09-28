import 'reflect-metadata';
import { PrometheusSqlLogger } from '../src/utils/PrometheusSqlLogger';

type LabelValues = Record<string, string>;

class CapturingCounter {
  public name: string;
  public calls: Array<{ lbl: LabelValues; v?: number }> = [];
  constructor(cfg: { name: string }) {
    this.name = cfg.name;
  }
  labels(lbl: LabelValues) {
    return { inc: (v?: number) => this.calls.push({ lbl, v }) };
  }
}
class CapturingHistogram {
  public name: string;
  public calls: Array<{ lbl: LabelValues; v: number }> = [];
  constructor(cfg: { name: string }) {
    this.name = cfg.name;
  }
  labels(lbl: LabelValues) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}
type TestPromCounter = {
  labels(labels: LabelValues): { inc: (v?: number) => void };
};
type TestPromHistogram = {
  labels(labels: LabelValues): { observe: (v: number) => void };
};
type TestPromClientLike = {
  Counter: new (cfg: Record<string, unknown>) => TestPromCounter;
  Histogram: new (cfg: Record<string, unknown>) => TestPromHistogram;
};
const fakeClient = {
  Counter: CapturingCounter,
  Histogram: CapturingHistogram
} as unknown as TestPromClientLike;

describe('PrometheusSqlLogger labels', () => {
  it('emits provider/operation/entity/success labels', () => {
    const logger = new PrometheusSqlLogger('svc', { client: fakeClient, prefix: 'tsl_' });
    // @ts-ignore access test internals
    const queryTotal: CapturingCounter = (logger as unknown as { queryTotal: CapturingCounter })
      .queryTotal;
    // @ts-ignore
    const queryDuration: CapturingHistogram = (
      logger as unknown as { queryDuration: CapturingHistogram }
    ).queryDuration;
    logger.queryEnd?.({
      sql: 'SELECT * FROM "Users"',
      params: [],
      durationMs: 12,
      provider: 'postgresql'
    });
    expect(queryTotal.calls.length).toBe(1);
    expect(queryDuration.calls.length).toBe(1);
    const lbl: LabelValues = queryTotal.calls[0].lbl;
    expect(lbl.provider).toBe('postgresql');
    expect(lbl.operation).toBe('SELECT');
    // entity parser upper-cases SQL before extracting, then strips quotes
    expect(lbl.entity).toBe('USERS');
    expect(lbl.success).toBe('true');
  });

  it('records error_type when error present', () => {
    const logger = new PrometheusSqlLogger('svc', { client: fakeClient, prefix: 'tsl_' });
    // @ts-ignore
    const errorTotal: CapturingCounter = (logger as unknown as { errorTotal: CapturingCounter })
      .errorTotal;
    logger.queryEnd?.({
      sql: 'UPDATE Users SET name = $1',
      params: ['x'],
      durationMs: 5,
      provider: 'postgresql',
      error: new TypeError('boom')
    });
    expect(errorTotal.calls.length).toBe(1);
    const lbl: LabelValues = errorTotal.calls[0].lbl;
    expect(lbl.error_type).toBe('TypeError');
  });
});
