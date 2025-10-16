import 'reflect-metadata';
import type { SqlDialect } from '@ts-linq/core/src/query/SqlDialect';
import { DatabaseProvider } from '@ts-linq/core/src/DatabaseProvider';
import type { SqlLogger, SqlParameter, QueryAnalysisInfo } from '@ts-linq/core/src/types';

class TestLogger implements SqlLogger {
  public readonly analyses: QueryAnalysisInfo[] = [];
  analysis(info: QueryAnalysisInfo): void {
    this.analyses.push(info);
  }
}

class TestProvider extends DatabaseProvider {
  constructor(logger?: SqlLogger) {
    super(':memory:', logger);
    // set logical provider label for metrics
    (this as unknown as { providerName: string }).providerName = 'sqlite';
  }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return {} as unknown as SqlDialect;
  }
  public async insert<T extends object>(entity: T): Promise<T> {
    return entity;
  }
  public async update<T extends object>(entity: T): Promise<T> {
    return entity;
  }
  public async delete<T extends object>(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [] as T[];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [] as T[];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [] as T[];
  }
  protected async doExecuteQuery<T>(sql: string, _params?: readonly SqlParameter[]): Promise<T[]> {
    // Simulate slow SELECT to trigger analysis and explain
    await new Promise((r) => setTimeout(r, 300));
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(
    _sql: string,
    _params?: readonly SqlParameter[]
  ): Promise<number> {
    await new Promise((r) => setTimeout(r, 250));
    return 1;
  }
  protected async getExplainPlan(_sql: string): Promise<unknown | undefined> {
    return { plan: 'ok' };
  }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
}

describe('Query Performance Analysis flow', () => {
  it('emits analysis event with slow flag and explain when thresholds are met (SELECT only)', async () => {
    const logger = new TestLogger();
    const prov = new TestProvider(logger);
    prov.configureQueryAnalysis({
      enabled: true,
      slowQueryThresholdMs: 100,
      explainThresholdMs: 200,
      rateLimitPerMinute: 1000,
      sampleRate: 1,
      onlySelect: true,
      explainTimeoutMs: 1000,
      maxExplainChars: 1024
    });
    const rows = await prov.executeQuery<{ x: number }>('SELECT 1 FROM users', []);
    expect(Array.isArray(rows)).toBe(true);
    expect(logger.analyses.length).toBe(1);
    const a = logger.analyses[0];
    expect(a.slow).toBe(true);
    expect(a.explainPlan).toBeDefined();
    expect(a.provider).toBe('sqlite');
  });

  it('does not emit analysis for non-SELECT when onlySelect=true', async () => {
    const logger = new TestLogger();
    const prov = new TestProvider(logger);
    prov.configureQueryAnalysis({
      enabled: true,
      onlySelect: true,
      explainThresholdMs: 10,
      slowQueryThresholdMs: 10,
      sampleRate: 1,
      rateLimitPerMinute: 1000
    });
    await prov.executeNonQuery('UPDATE users SET name = ? WHERE id = ?', ['A', 1]);
    expect(logger.analyses.length).toBe(0);
  });
});
