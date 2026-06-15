import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DatabaseProvider } from '@ts-linq/core';
import { MigrationApplyError } from '@ts-linq/types';

import { Migration } from '../../src/Migration';
import { MigrationRunner } from '../../src/MigrationRunner';
import type {
  MigrationHistoryStore,
  MigrationRecord
} from '../../src/runner/MigrationHistoryStore';
import type { MigrationLogger } from '../../src/runner/MigrationLogger';
import {
  type TransactionCapableProvider,
  TransactionScope
} from '../../src/runner/TransactionScope';

class TestMigration extends Migration {
  constructor(
    private _version: string,
    private _name: string,
    private _up: () => Promise<void>,
    private _down: () => Promise<void> = async () => {}
  ) {
    super();
  }
  protected get version(): string {
    return this._version;
  }
  protected get name(): string {
    return this._name;
  }
  public async up(): Promise<void> {
    await this._up();
  }
  public async down(): Promise<void> {
    await this._down();
  }
}

/** Records orchestration events into a shared log and lets tests pre-load applied records. */
function createFakeStore(events: string[], applied: MigrationRecord[] = []): MigrationHistoryStore {
  return {
    ensureExists: async () => {
      events.push('ensure');
    },
    list: async () => [...applied],
    record: async (version) => {
      events.push(`record:${version}`);
    },
    remove: async (version) => {
      events.push(`remove:${version}`);
    }
  };
}

function createTxProvider(
  events: string[],
  opts: { rollbackThrows?: Error } = {}
): TransactionCapableProvider {
  return {
    beginTransaction: (async () => {
      events.push('begin');
    }) as TransactionCapableProvider['beginTransaction'],
    commitTransaction: (async () => {
      events.push('commit');
    }) as TransactionCapableProvider['commitTransaction'],
    rollbackTransaction: (async () => {
      events.push('rollback');
      if (opts.rollbackThrows) {
        throw opts.rollbackThrows;
      }
    }) as TransactionCapableProvider['rollbackTransaction']
  };
}

function createSpyLogger(): MigrationLogger & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    info: (m) => messages.push(`info:${m}`),
    warn: (m) => messages.push(`warn:${m}`),
    error: (m) => messages.push(`error:${m}`)
  };
}

// `provider` is only used to satisfy the required positional argument; all behaviour is injected.
const unusedProvider = {} as unknown as DatabaseProvider;

describe('MigrationRunner (injected collaborators)', () => {
  let consoleLog: ReturnType<typeof jest.spyOn>;
  let consoleError: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('applies in begin → up → record → commit order', async () => {
    const events: string[] = [];
    const runner = new MigrationRunner(unusedProvider, {
      historyStore: createFakeStore(events),
      transactionScope: new TransactionScope(createTxProvider(events))
    });
    runner.addMigration(
      new TestMigration('001', 'CreateUsers', async () => {
        events.push('up');
      })
    );

    await runner.migrate();

    // 'ensure' + 'list' precede the per-migration block; assert the tx-scoped ordering.
    expect(events).toEqual(['ensure', 'begin', 'up', 'record:001', 'commit']);
  });

  it('logs progress through the injected port, never console', async () => {
    const logger = createSpyLogger();
    const runner = new MigrationRunner(unusedProvider, {
      historyStore: createFakeStore([]),
      transactionScope: new TransactionScope(createTxProvider([])),
      logger
    });
    runner.addMigration(new TestMigration('001', 'CreateUsers', async () => {}));

    await runner.migrate();

    expect(logger.messages).toContain('info:Applying migration: CreateUsers');
    expect(logger.messages).toContain('info:Migration CreateUsers applied successfully');
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('wraps an up() failure in MigrationApplyError with the original cause and rolls back', async () => {
    const events: string[] = [];
    const original = new Error('DDL exploded');
    const runner = new MigrationRunner(unusedProvider, {
      historyStore: createFakeStore(events),
      transactionScope: new TransactionScope(createTxProvider(events))
    });
    runner.addMigration(
      new TestMigration('001', 'Failing', async () => {
        throw original;
      })
    );

    let caught: unknown;
    try {
      await runner.migrate();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MigrationApplyError);
    expect((caught as MigrationApplyError).cause).toBe(original);
    expect((caught as MigrationApplyError).details).toEqual({ version: '001', name: 'Failing' });
    expect(events).toContain('rollback');
    expect(events).not.toContain('commit');
  });

  it('preserves the original cause even when rollback also fails (suppressed)', async () => {
    const events: string[] = [];
    const original = new Error('DDL exploded');
    const rollbackFailure = new Error('rollback exploded');
    const runner = new MigrationRunner(unusedProvider, {
      historyStore: createFakeStore(events),
      transactionScope: new TransactionScope(
        createTxProvider(events, { rollbackThrows: rollbackFailure })
      )
    });
    runner.addMigration(
      new TestMigration('001', 'Failing', async () => {
        throw original;
      })
    );

    let caught: unknown;
    try {
      await runner.migrate();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MigrationApplyError);
    const cause = (caught as MigrationApplyError).cause as { suppressed?: unknown[] };
    expect(cause).toBe(original);
    expect(cause.suppressed).toEqual([rollbackFailure]);
  });
});
