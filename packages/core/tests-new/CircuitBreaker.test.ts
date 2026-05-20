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

  public override async connect(): Promise<void> {
    this.isConnected = true;
  }

  public override async disconnect(): Promise<void> {
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

  public override async beginTransaction(): Promise<void> {}
  public override async commitTransaction(): Promise<void> {}
  public override async rollbackTransaction(): Promise<void> {}
  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}
}

class FlakyProvider extends TestProvider {
  private remainingFails: number;

  constructor(fails: number, openMs: number = 1000) {
    super();
    this.remainingFails = fails;
    this.configureCircuit({
      enabled: true,
      failureThreshold: 2,
      openDurationMs: openMs,
      maxOpenDurationMs: openMs,
      halfOpenMaxCalls: 1,
      countTransientOnly: true
    });
  }

  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    if (this.remainingFails > 0) {
      this.remainingFails--;
      const err = new Error('timeout');
      throw err;
    }
    return await super.doExecuteNonQuery(sql, params);
  }
}

describe('Circuit Breaker', () => {
  it('should open after failure threshold and short-circuit', async () => {
    const provider = new FlakyProvider(2, 100);

    // 1st and 2nd attempts fail and count towards threshold
    await expect(provider.executeNonQuery('DELETE FROM t')).rejects.toBeTruthy();
    await expect(provider.executeNonQuery('DELETE FROM t')).rejects.toBeTruthy();

    // Immediately after threshold, circuit must be open and short-circuit
    await expect(provider.executeNonQuery('DELETE FROM t')).rejects.toBeInstanceOf(
      CircuitOpenError
    );
  });

  it('should move to half-open after cooldown and close on successful probe', async () => {
    const provider = new FlakyProvider(2, 1000);

    // Open the circuit
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeInstanceOf(
      CircuitOpenError
    );

    // Wait for cooldown to allow half-open probe
    await new Promise((r) => setTimeout(r, 1100));

    // remainingFails is 0 now → probe succeeds → circuit closes
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(0);

    // Next calls should be allowed (closed)
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(0);
  });

  it('should re-open immediately when half-open probe fails', async () => {
    const provider = new FlakyProvider(3, 1000);

    // Drive to open (2 failures)
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeInstanceOf(
      CircuitOpenError
    );

    // Wait for cooldown → half-open; we still have one remaining failure
    await new Promise((r) => setTimeout(r, 1100));
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();

    // After failed probe, circuit is open again; next call should short-circuit
    await expect(provider.executeNonQuery('UPDATE t SET a=1')).rejects.toBeInstanceOf(
      CircuitOpenError
    );
  });

  it('should respect circuit state getter', () => {
    const provider = new TestProvider();
    expect(provider.circuitStateLabel).toBe('closed');
  });

  it('should allow manual circuit configuration', () => {
    const provider = new TestProvider();
    provider.configureCircuit({
      enabled: true,
      failureThreshold: 10,
      openDurationMs: 5000
    });
    expect(provider.circuitStateLabel).toBe('closed');
  });

  it('should allow manual circuit open', () => {
    const provider = new TestProvider();
    provider.forceOpen('test', 1000);
    expect(provider.circuitStateLabel).toBe('open');
  });

  it('should allow manual circuit reset', () => {
    const provider = new TestProvider();
    provider.forceOpen('test', 1000);
    expect(provider.circuitStateLabel).toBe('open');
    provider.manualReset('manual reset');
    expect(provider.circuitStateLabel).toBe('closed');
  });
});
