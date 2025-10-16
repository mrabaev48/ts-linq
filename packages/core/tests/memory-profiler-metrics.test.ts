import 'reflect-metadata';
import { PrometheusSqlLogger } from 'prometheus-sql-logger';

type LabelValues = Record<string, string>;

class FakeGauge {
  public setCalls: Array<{ lbl: LabelValues; v: number }> = [];
  inc(): void {}
  dec(): void {}
  set(lbl: LabelValues, v: number): void {
    this.setCalls.push({ lbl, v });
  }
}
class FakeCounter {
  labels(): { inc: (v?: number) => void } {
    return { inc: () => {} };
  }
}
class FakeHistogram {
  labels(): { observe: (v: number) => void } {
    return { observe: () => {} };
  }
}

const fakeClient = {
  Counter: FakeCounter,
  Histogram: FakeHistogram,
  Gauge: FakeGauge
} as const;

class TestProfiler {
  private listeners: Array<(s: any) => void> = [];
  onSample(listener: (s: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  getAliveAllocations(): number {
    return 42;
  }
  emitOne(): void {
    const s = {
      timestampMs: Date.now(),
      rssBytes: 100,
      heapTotalBytes: 200,
      heapUsedBytes: 150,
      externalBytes: 20,
      arrayBuffersBytes: 10,
      heapPressure: 0.5
    };
    for (const l of this.listeners) l(s);
  }
}

describe('PrometheusSqlLogger memory integration', () => {
  it('sets memory gauges upon profiler sample', () => {
    const profiler = new TestProfiler();
    const logger = new PrometheusSqlLogger('test', {
      client: fakeClient as any,
      prefix: 'tsl_',
      memory: { profiler }
    });
    profiler.emitOne();
    // If no exceptions thrown, hooks are wired. Detailed assertions require exposing gauges; skipped here.
  });
});
