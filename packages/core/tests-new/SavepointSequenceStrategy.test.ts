import { describe, expect, it } from '@jest/globals';
import type { EntityMetadata, SqlDialect, SqlParameter } from '@ts-linq/types';
import { UnsupportedOperationError } from '@ts-linq/types';

import { DatabaseProvider } from '../src/DatabaseProvider';
import { ProviderConfig } from '../src/ProviderConfig';
import { AnsiSavepointStrategy } from '../src/strategies/SavepointStrategy';
import type { SequenceStrategy } from '../src/strategies/SequenceStrategy';
import { UnsupportedSequenceStrategy } from '../src/strategies/SequenceStrategy';

class NoopDialect implements SqlDialect {
  public quoteIdentifier(id: string): string {
    return `"${id}"`;
  }
  public buildSelect(): { query: string; parameters: [] } {
    return { query: '', parameters: [] };
  }
}

class RecordingProvider extends DatabaseProvider {
  public readonly nonQueries: string[] = [];
  constructor(config: ProviderConfig) {
    super(config);
  }
  protected async doConnect(): Promise<void> {}
  protected async doDisconnect(): Promise<void> {}
  public async createTable(_m: EntityMetadata): Promise<void> {}
  public getDialect(): SqlDialect {
    return new NoopDialect();
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete<T extends object>(): Promise<void> {}
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
  protected async doExecuteNonQuery(
    sql: string,
    _params?: readonly SqlParameter[]
  ): Promise<number> {
    this.nonQueries.push(sql);
    return 0;
  }
  protected async doBeginTransaction(): Promise<void> {}
  protected async doCommitTransaction(): Promise<void> {}
  protected async doRollbackTransaction(): Promise<void> {}
}

describe('AnsiSavepointStrategy', () => {
  it('emits standard SQL for all three operations', () => {
    const s = new AnsiSavepointStrategy();
    expect(s.createSql('sp1')).toBe('SAVEPOINT sp1');
    expect(s.rollbackToSql('sp1')).toBe('ROLLBACK TO SAVEPOINT sp1');
    expect(s.releaseSql('sp1')).toBe('RELEASE SAVEPOINT sp1');
  });
});

describe('UnsupportedSequenceStrategy', () => {
  it('rejects with UnsupportedOperationError carrying the operation detail', async () => {
    const s = new UnsupportedSequenceStrategy();
    const port = {
      executeQuery: async () => [],
      executeNonQuery: async () => 0,
      providerLabel: 'x'
    };
    const err = await s.nextValue(port).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsupportedOperationError);
    expect((err as UnsupportedOperationError).details).toMatchObject({
      operation: 'nextSequenceValue',
      provider: 'x'
    });
  });
});

describe('DatabaseProvider savepoint/sequence delegation', () => {
  it('runs ANSI savepoint SQL through the default strategy', async () => {
    const p = new RecordingProvider(
      new ProviderConfig({ providerName: 'test', connectionString: 'c' })
    );
    await p.createSavepoint('sp1');
    await p.rollbackToSavepoint('sp1');
    await p.releaseSavepoint('sp1');
    expect(p.nonQueries).toEqual([
      'SAVEPOINT sp1',
      'ROLLBACK TO SAVEPOINT sp1',
      'RELEASE SAVEPOINT sp1'
    ]);
  });

  it('skips no-op (null) savepoint SQL without executing', async () => {
    const noRelease = {
      createSql: (n: string) => `SAVE TRANSACTION ${n}`,
      rollbackToSql: (n: string) => `ROLLBACK TRANSACTION ${n}`,
      releaseSql: () => null
    };
    const p = new RecordingProvider(
      new ProviderConfig({
        providerName: 'test',
        connectionString: 'c',
        savepointStrategy: noRelease
      })
    );
    await p.releaseSavepoint('sp1');
    expect(p.nonQueries).toEqual([]);
  });

  it('delegates nextSequenceValue to the injected sequence strategy', async () => {
    const calls: Array<{ name: string; schema?: string; block: number }> = [];
    const strategy: SequenceStrategy = {
      nextValue: async (_port, name, schema, block) => {
        calls.push({ name, schema, block });
        return 99;
      }
    };
    const p = new RecordingProvider(
      new ProviderConfig({
        providerName: 'test',
        connectionString: 'c',
        sequenceStrategy: strategy
      })
    );
    const value = await p.nextSequenceValue('seq', 'dbo', 10);
    expect(value).toBe(99);
    expect(calls).toEqual([{ name: 'seq', schema: 'dbo', block: 10 }]);
  });

  it('throws UnsupportedOperationError by default for nextSequenceValue', async () => {
    const p = new RecordingProvider(
      new ProviderConfig({ providerName: 'test', connectionString: 'c' })
    );
    await expect(p.nextSequenceValue('seq', undefined, 1)).rejects.toBeInstanceOf(
      UnsupportedOperationError
    );
  });
});
