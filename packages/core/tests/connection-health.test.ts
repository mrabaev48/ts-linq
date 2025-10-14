import { DatabaseProvider } from '../src/DatabaseProvider';
import type {
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  EntityMetadata,
  SqlDialect,
  SqlLogger,
  SqlParameter
} from '../src/types';

class TestProvider extends DatabaseProvider {
  public start(runPing: () => Promise<number>): void {
    // protected method exposed for testing
    this.startHealthChecks(runPing);
  }
  public stop(): void {
    this.stopHealthChecks();
  }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(_entityMetadata: EntityMetadata): Promise<void> {}
  public getDialect(): SqlDialect {
    return {} as unknown as SqlDialect;
  }
  public async insert<T extends object>(entity: T): Promise<T> {
    return entity;
  }
  public async update<T extends object>(entity: T): Promise<T> {
    return entity;
  }
  public async delete<T extends object>(_entity: T): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
}

describe('DatabaseProvider health-check scheduler', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('emits healthy=true on successful ping', async () => {
    const events: Array<{ healthy: boolean; latencyMs?: number }> = [];
    const logger: SqlLogger = {
      connectionHealth: (e) => events.push({ healthy: e.healthy, latencyMs: e.latencyMs })
    };
    const pool: ConnectionPoolOptions | undefined = { max: 5 };
    const hc: ConnectionHealthCheckOptions | undefined = {
      enabled: true,
      intervalMs: 50,
      timeoutMs: 1000
    };
    const p = new TestProvider('dummy', logger, undefined, undefined, undefined, pool, hc);
    let called = 0;
    p.start(async () => {
      called += 1;
      return 1;
    });

    // подождём немного реального времени для выполнения runOnce() и первого интервала
    await new Promise((r) => setTimeout(r, 120));
    expect(called).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].healthy).toBe(true);
    expect(typeof events[0].latencyMs === 'number').toBe(true);
    p.stop();
  }, 15000);

  test('emits degraded/unhealthy with backoff on consecutive failures', async () => {
    const events: Array<{ healthy: boolean }> = [];
    const logger: SqlLogger = { connectionHealth: (e) => events.push({ healthy: e.healthy }) };
    const hc: ConnectionHealthCheckOptions | undefined = {
      enabled: true,
      minIntervalMs: 20,
      maxIntervalMs: 100,
      degradeAfterFailures: 1,
      unhealthyAfterFailures: 2,
      timeoutMs: 5
    };
    const p = new TestProvider('dummy', logger, undefined, undefined, undefined, undefined, hc);
    // Never resolves -> should timeout
    p.start(() => new Promise<number>(() => {}));

    await new Promise((r) => setTimeout(r, 60));
    expect(events.some((e) => e.healthy === false)).toBe(true);
    // Next run with backoff
    await new Promise((r) => setTimeout(r, 140));
    expect(events.filter((e) => e.healthy === false).length).toBeGreaterThanOrEqual(2);
    p.stop();
  }, 15000);
});
