import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { PrometheusSqlLogger } from '@ts-linq/prometheus-sql-logger';
import { TestProvider } from '@ts-linq/testkits';

// --- MOCK PROMETHEUS CLIENT ---
class MockCounter {
  values = new Map<string, number>();
  labelsStr: string = '{}';
  constructor(public config: { name: string; help: string; labelNames: string[] }) {}
  labels(labels: Record<string, string>) {
    this.labelsStr = JSON.stringify(labels);
    return {
      inc: (v: number = 1) => {
        const current = this.values.get(this.labelsStr) || 0;
        this.values.set(this.labelsStr, current + v);
      }
    };
  }
}

class MockHistogram {
  values = new Map<string, number[]>();
  labelsStr: string = '{}';
  constructor(
    public config: { name: string; help: string; labelNames: string[]; buckets: number[] }
  ) {}
  labels(labels: Record<string, string>) {
    this.labelsStr = JSON.stringify(labels);
    return {
      observe: (v: number) => {
        const current = this.values.get(this.labelsStr) || [];
        current.push(v);
        this.values.set(this.labelsStr, current);
      }
    };
  }
}

class MockGauge {
  values = new Map<string, number>();
  labelsStr: string = '{}';
  constructor(public config: { name: string; help: string; labelNames: string[] }) {}
  inc(labels?: Record<string, string>, v: number = 1) {
    // ...
  }
  dec(labels?: Record<string, string>, v: number = 1) {
    // ...
  }
  set(labels: Record<string, string>, v: number) {
    const k = JSON.stringify(labels);
    this.values.set(k, v);
  }
}

const mockClient = {
  Counter: MockCounter,
  Histogram: MockHistogram,
  Gauge: MockGauge,
  register: {
    contentType: 'text/plain; version=0.0.4',
    metrics: async () => 'mock_metrics'
  }
};

@Entity({ name: 'prom_users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;
}

class TestDbContext extends DbContext {
  constructor(provider: TestProvider) {
    super({ provider });
  }
}

describe('Telemetry Integration - Prometheus + Provider', () => {
  let provider: TestProvider;
  let context: TestDbContext;
  let logger: PrometheusSqlLogger;

  beforeEach(async () => {
    // 1. Setup Logger with Mock Client
    logger = new PrometheusSqlLogger('test', {
      client: mockClient as any,
      prefix: 'tslinq_'
    });

    // 2. Setup Provider — pass logger so insert/update/delete fire queryStart/queryEnd
    provider = new TestProvider({ logger });

    // 3. Setup Context
    context = new TestDbContext(provider);
    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('should log SQL queries via PrometheusSqlLogger', async () => {
    // Arrange
    const users = context.set(User);
    users.add({ name: 'Alice' } as User);

    // Act — INSERT goes through TestProvider.insert → logger.queryEnd
    await context.saveChanges();

    // Assert
    const queryTotal = (logger as any).queryTotal as MockCounter;
    expect(queryTotal).toBeDefined();

    let found = false;
    for (const [labelsStr, val] of queryTotal.values.entries()) {
      const labels = JSON.parse(labelsStr);
      if (labels.operation === 'INSERT' && labels.entity === 'PROM_USERS') {
        expect(val).toBeGreaterThanOrEqual(1);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('should track query duration histogram', async () => {
    // Arrange
    const users = context.set(User);
    users.add({ name: 'Bob' } as User);
    await context.saveChanges();

    // Act — SELECT goes through executeWithRetry → logger.queryEnd
    await users.toArray();

    // Assert
    const duration = (logger as any).queryDuration as MockHistogram;
    expect(duration).toBeDefined();

    let found = false;
    for (const [labelsStr, vals] of duration.values.entries()) {
      const labels = JSON.parse(labelsStr);
      if (labels.operation === 'SELECT') {
        expect(vals.length).toBeGreaterThan(0);
        expect(vals[0]).toBeGreaterThanOrEqual(0);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('should track error counter by type', async () => {
    // TestProvider.doExecuteNonQuery returns 0 by default (no real DB).
    // Override it to simulate a DB error so logger.queryEnd receives an error payload.
    jest
      .spyOn(provider, 'doExecuteNonQuery')
      .mockRejectedValueOnce(new Error('Connection timeout'));

    try {
      await provider.executeNonQuery('SELECT * FROM non_existent_table');
    } catch {
      // expected — the error triggers logger.queryEnd({ error })
    }

    // Assert errorTotal was incremented
    const errorTotal = (logger as any).errorTotal as MockCounter;
    expect(errorTotal).toBeDefined();

    let found = false;
    for (const [labelsStr, val] of errorTotal.values.entries()) {
      const labels = JSON.parse(labelsStr);
      if (labels.error_type) {
        expect(val).toBeGreaterThan(0);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
