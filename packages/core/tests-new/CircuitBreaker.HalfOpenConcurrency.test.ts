import { describe, expect, it } from '@jest/globals';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata, QueryOptions, SqlDialect, SqlParameter } from '@ts-linq/types';

import { DatabaseProvider } from '../src/DatabaseProvider';
import { CircuitOpenError } from '../src/types';

class TestDialect implements SqlDialect {
  public quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  public buildSelect(
    entityClass: new () => unknown,
    options: QueryOptions
  ): { query: string; parameters: SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const query = `SELECT ${options.distinct ? 'DISTINCT ' : ''}* FROM ${meta.tableName}`;
    return { query, parameters: [] };
  }
}

class TestProvider extends DatabaseProvider {
  constructor() {
    super('test', undefined, undefined, undefined, undefined, undefined, undefined);
    this.providerName = 'test';
  }

  public async connect(): Promise<void> {
    this.isConnected = true;
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  public async createTable(_entityMetadata: EntityMetadata): Promise<void> {}

  public getDialect(): SqlDialect {
    return new TestDialect();
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

  protected async doExecuteQuery<T>(
    _sql: string,
    _params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    return [];
  }

  protected async doExecuteNonQuery(
    _sql: string,
    _params: readonly SqlParameter[] = []
  ): Promise<number> {
    return 0;
  }

  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
}

class FlakyProviderConcurrent extends TestProvider {
  private remainingFails: number;

  constructor(fails: number, openMs: number = 1000) {
    super();
    this.remainingFails = fails;
    this.configureCircuit({
      enabled: true,
      failureThreshold: 1,
      openDurationMs: openMs,
      halfOpenMaxCalls: 2
    });
  }

  protected async doExecuteNonQuery(sql: string): Promise<number> {
    if (this.remainingFails > 0) {
      this.remainingFails--;
      const err = new Error('timeout');
      throw err;
    }
    await new Promise((r) => setTimeout(r, 10));
    return 0;
  }
}

describe('Circuit Breaker - Half-Open Concurrency', () => {
  it('should limit half-open concurrent probes', async () => {
    const provider = new FlakyProviderConcurrent(1, 1000);

    // Open circuit after one failure
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeInstanceOf(
      CircuitOpenError
    );

    // Wait to move to half-open
    await new Promise((r) => setTimeout(r, 1100));

    // Start 2 allowed probes concurrently + 1 extra which should be short-circuited
    const a = provider.executeNonQuery('UPDATE t SET a=1');
    const b = provider.executeNonQuery('UPDATE t SET a=1');
    const c = provider.executeNonQuery('UPDATE t SET a=1');

    const results = await Promise.allSettled([a, b, c]);

    const rejectedOpen = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof CircuitOpenError
    );

    // At least one should be rejected due to half-open probe limit
    expect(rejectedOpen.length).toBeGreaterThanOrEqual(1);
  });

  it('should allow concurrent calls after circuit closes', async () => {
    const provider = new FlakyProviderConcurrent(0, 1000); // No failures

    // Circuit should start closed
    expect(provider.circuitStateLabel).toBe('closed');

    // Multiple concurrent calls should all succeed when circuit is closed
    const results = await Promise.all([
      provider.executeNonQuery('UPDATE t SET a=1'),
      provider.executeNonQuery('UPDATE t SET a=1'),
      provider.executeNonQuery('UPDATE t SET a=1'),
      provider.executeNonQuery('UPDATE t SET a=1')
    ]);

    expect(results).toEqual([0, 0, 0, 0]);
    expect(provider.circuitStateLabel).toBe('closed');
  });
});
