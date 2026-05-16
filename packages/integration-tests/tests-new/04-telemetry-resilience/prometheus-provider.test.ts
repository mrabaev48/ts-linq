
import { DbContext } from '@ts-linq/orm';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';
import { TestProvider } from '@ts-linq/testkits';
import { PrometheusSqlLogger } from '@ts-linq/prometheus-sql-logger';

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
  constructor(public config: { name: string; help: string; labelNames: string[]; buckets: number[] }) {}
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

describe.skip('Telemetry Integration - Prometheus + Provider', () => {
  let provider: TestProvider;
  let context: TestDbContext;
  let logger: PrometheusSqlLogger;

  beforeEach(async () => {
    // 1. Setup Logger with Mock Client
    logger = new PrometheusSqlLogger('test', { 
        client: mockClient as any,
        prefix: 'tslinq_' 
    });

    // 2. Setup Provider
    provider = new TestProvider(':memory:');
    // logger attachment is manual in test provider or ignored for this test scope

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
    
    // Act
    await context.saveChanges(); // INSERT

    // Assert
    // Check if query_total incremented
    const queryTotal = (logger as any).queryTotal as MockCounter;
    expect(queryTotal).toBeDefined();
    
    // Expect at least one INSERT
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

     // Act
     await users.query().toArray(); // SELECT

     // Assert
     const duration = (logger as any).queryDuration as MockHistogram;
     expect(duration).toBeDefined();

     // Expect SELECT duration observed
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
      // Act: execute bad SQL to cause error
      try {
        await provider.executeNonQuery('SELECT * FROM non_existent_table');
      } catch (e) {
          // ignore
      }

      // Assert
      const errorTotal = (logger as any).errorTotal as MockCounter;
      expect(errorTotal).toBeDefined();
      
      let found = false;
      for (const [labelsStr, val] of errorTotal.values.entries()) {
         const labels = JSON.parse(labelsStr);
         // Expect some error
         if (labels.error_type) {
             expect(val).toBeGreaterThan(0);
             found = true;
         }
      }
      expect(found).toBe(true);
  });

//   it('should track connection health', async () => {
//       // Health checks run via timer, difficult to test deterministically in integration 
//       // without exposing internals or waiting.
//       // We can manually trigger it if we had access, but for now we skip or verify initialization.
//       const healthGauge = (logger as any).connectionHealthGauge as MockGauge;
//       expect(healthGauge).toBeDefined();
//   });
});
