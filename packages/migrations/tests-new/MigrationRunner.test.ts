import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DatabaseProvider } from '@ts-linq/core';
import { MigrationApplyError, MigrationRollbackError } from '@ts-linq/types';

import { Migration } from '../src/Migration';
import { MigrationRunner } from '../src/MigrationRunner';

class TestMigration extends Migration {
  constructor(
    private _version: string,
    private _name: string,
    private _upFn: () => Promise<void>,
    private _downFn: () => Promise<void>
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
    await this._upFn();
  }

  public async down(): Promise<void> {
    await this._downFn();
  }
}

function createMockProvider(): DatabaseProvider {
  const queries: string[] = [];
  const nonQueries: Array<{ sql: string; params?: unknown[] }> = [];
  const migrations: Array<{ version: string; name: string; applied_at: string }> = [];
  let transactionActive = false;
  let tableCreated = false;

  // The bookkeeping table "exists" once its DDL has run or once it holds rows — a record cannot
  // be present without the table. This models the `information_schema.tables` existence probe the
  // store now performs to distinguish "table absent" from "query failed".
  const tableExists = (): boolean => tableCreated || migrations.length > 0;

  return {
    providerLabel: 'postgresql',

    executeQuery: jest.fn(async <T = unknown>(sql: string): Promise<T[]> => {
      queries.push(sql);
      if (sql.includes('information_schema.tables')) {
        return [{ cnt: tableExists() ? 1 : 0 }] as T[];
      }
      if (sql.includes('SELECT version, name, applied_at FROM __migrations')) {
        return migrations as T[];
      }
      return [];
    }) as DatabaseProvider['executeQuery'],

    executeNonQuery: jest.fn(async (sql: string, params?: unknown[]): Promise<number> => {
      nonQueries.push({ sql, params });

      if (sql.includes('CREATE TABLE') && sql.includes('__migrations')) {
        tableCreated = true;
      } else if (sql.includes('INSERT INTO __migrations')) {
        const [version, name, applied_at] = params as [string, string, string];
        migrations.push({ version, name, applied_at });
      } else if (sql.includes('DELETE FROM __migrations')) {
        const [version] = params as [string];
        const index = migrations.findIndex((m) => m.version === version);
        if (index !== -1) {
          migrations.splice(index, 1);
        }
      }

      return 1;
    }) as DatabaseProvider['executeNonQuery'],

    beginTransaction: jest.fn(async (): Promise<void> => {
      transactionActive = true;
    }) as DatabaseProvider['beginTransaction'],

    commitTransaction: jest.fn(async (): Promise<void> => {
      transactionActive = false;
    }) as DatabaseProvider['commitTransaction'],

    rollbackTransaction: jest.fn(async (): Promise<void> => {
      transactionActive = false;
    }) as DatabaseProvider['rollbackTransaction'],

    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    getDatabaseName: jest.fn(() => 'test'),
    getSqlDialect: jest.fn(),
    _getQueries: () => queries,
    _getNonQueries: () => nonQueries,
    _getMigrations: () => migrations,
    _isTransactionActive: () => transactionActive
  } as unknown as DatabaseProvider;
}

describe('MigrationRunner', () => {
  let provider: DatabaseProvider;
  let runner: MigrationRunner;

  beforeEach(() => {
    provider = createMockProvider();
    runner = new MigrationRunner(provider);
  });

  describe('ensureMigrationTableExists()', () => {
    it('should create migrations table', async () => {
      await runner.ensureMigrationTableExists();

      expect(provider.executeNonQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS __migrations')
      );
    });
  });

  describe('getAppliedMigrations()', () => {
    it('should return empty array when no migrations applied', async () => {
      const applied = await runner.getAppliedMigrations();

      expect(applied).toEqual([]);
    });

    it('should return applied migrations from database', async () => {
      const mockProvider = provider as unknown as {
        _getMigrations: () => Array<{ version: string; name: string; applied_at: string }>;
      };
      mockProvider._getMigrations().push({
        version: '001',
        name: 'CreateUsers',
        applied_at: '2025-01-01T00:00:00.000Z'
      });

      const applied = await runner.getAppliedMigrations();

      expect(applied).toHaveLength(1);
      expect(applied[0].version).toBe('001');
      expect(applied[0].name).toBe('CreateUsers');
      expect(applied[0].appliedAt).toBeInstanceOf(Date);
    });

    it('propagates database errors instead of swallowing them', async () => {
      // Previously this swallowed every error and returned [] — making a failing DB look like
      // "no migrations applied" and risking re-running already-applied migrations. The store now
      // surfaces genuine query failures instead of masquerading them as an empty result.
      const errorProvider = createMockProvider();
      const mockQuery = errorProvider.executeQuery as jest.MockedFunction<
        typeof errorProvider.executeQuery
      >;
      mockQuery.mockRejectedValue(new Error('Connection lost'));

      const errorRunner = new MigrationRunner(errorProvider);

      await expect(errorRunner.getAppliedMigrations()).rejects.toThrow('Connection lost');
    });
  });

  describe('addMigration()', () => {
    it('should register migration', () => {
      const migration = new TestMigration(
        '001',
        'Test',
        async () => {},
        async () => {}
      );

      runner.addMigration(migration);

      expect(migration.getVersion()).toBe('001');
      expect(migration.getName()).toBe('Test');
    });

    it('should sort migrations by version', () => {
      const migration1 = new TestMigration(
        '003',
        'Third',
        async () => {},
        async () => {}
      );
      const migration2 = new TestMigration(
        '001',
        'First',
        async () => {},
        async () => {}
      );
      const migration3 = new TestMigration(
        '002',
        'Second',
        async () => {},
        async () => {}
      );

      runner.addMigration(migration1);
      runner.addMigration(migration2);
      runner.addMigration(migration3);

      // Migrations should be sorted internally
      // Verified by running migrate() and checking execution order
    });
  });

  describe('migrate()', () => {
    it('should apply pending migration', async () => {
      const upFn = jest.fn(async () => {
        await provider.executeNonQuery('CREATE TABLE users (id INTEGER)');
      });
      const downFn = jest.fn(async () => {});

      const migration = new TestMigration('001', 'CreateUsers', upFn, downFn);
      runner.addMigration(migration);

      await runner.migrate();

      expect(upFn).toHaveBeenCalled();
      expect(provider.beginTransaction).toHaveBeenCalled();
      expect(provider.commitTransaction).toHaveBeenCalled();
    });

    it('should record migration in database', async () => {
      const migration = new TestMigration(
        '001',
        'CreateUsers',
        async () => {},
        async () => {}
      );
      runner.addMigration(migration);

      await runner.migrate();

      const applied = await runner.getAppliedMigrations();
      expect(applied).toHaveLength(1);
      expect(applied[0].version).toBe('001');
      expect(applied[0].name).toBe('CreateUsers');
    });

    it('should skip already applied migrations', async () => {
      const upFn = jest.fn(async () => {});
      const migration = new TestMigration('001', 'CreateUsers', upFn, async () => {});
      runner.addMigration(migration);

      await runner.migrate();
      await runner.migrate();

      expect(upFn).toHaveBeenCalledTimes(1);
    });

    it('should apply multiple pending migrations in order', async () => {
      const executionOrder: string[] = [];

      const migration1 = new TestMigration(
        '001',
        'First',
        async () => {
          executionOrder.push('001');
        },
        async () => {}
      );
      const migration2 = new TestMigration(
        '002',
        'Second',
        async () => {
          executionOrder.push('002');
        },
        async () => {}
      );
      const migration3 = new TestMigration(
        '003',
        'Third',
        async () => {
          executionOrder.push('003');
        },
        async () => {}
      );

      runner.addMigration(migration2);
      runner.addMigration(migration3);
      runner.addMigration(migration1);

      await runner.migrate();

      expect(executionOrder).toEqual(['001', '002', '003']);
    });

    it('should rollback on migration failure', async () => {
      const upFn = jest.fn(async () => {
        throw new Error('Migration failed');
      });
      const migration = new TestMigration('001', 'Failing', upFn, async () => {});
      runner.addMigration(migration);

      await expect(runner.migrate()).rejects.toThrow(MigrationApplyError);

      expect(provider.rollbackTransaction).toHaveBeenCalled();
    });

    it('should not record failed migration', async () => {
      const upFn = jest.fn(async () => {
        throw new Error('Migration failed');
      });
      const migration = new TestMigration('001', 'Failing', upFn, async () => {});
      runner.addMigration(migration);

      await expect(runner.migrate()).rejects.toThrow();

      const applied = await runner.getAppliedMigrations();
      expect(applied).toHaveLength(0);
    });

    it('should wrap migration in transaction', async () => {
      const mockProvider = provider as unknown as {
        _isTransactionActive: () => boolean;
      };
      let transactionActiveAtExecution = false;

      const upFn = jest.fn(async () => {
        transactionActiveAtExecution = mockProvider._isTransactionActive();
      });
      const migration = new TestMigration('001', 'Test', upFn, async () => {});
      runner.addMigration(migration);

      await runner.migrate();

      expect(transactionActiveAtExecution).toBe(true);
      expect(mockProvider._isTransactionActive()).toBe(false);
    });
  });

  describe('rollback()', () => {
    it('should rollback last migration', async () => {
      const downFn = jest.fn(async () => {});
      const migration = new TestMigration('001', 'CreateUsers', async () => {}, downFn);
      runner.addMigration(migration);

      await runner.migrate();
      await runner.rollback();

      expect(downFn).toHaveBeenCalled();
    });

    it('should remove migration record from database', async () => {
      const migration = new TestMigration(
        '001',
        'CreateUsers',
        async () => {},
        async () => {}
      );
      runner.addMigration(migration);

      await runner.migrate();
      await runner.rollback();

      const applied = await runner.getAppliedMigrations();
      expect(applied).toHaveLength(0);
    });

    it('should rollback multiple migrations in reverse order', async () => {
      const executionOrder: string[] = [];

      const migration1 = new TestMigration(
        '001',
        'First',
        async () => {},
        async () => {
          executionOrder.push('001');
        }
      );
      const migration2 = new TestMigration(
        '002',
        'Second',
        async () => {},
        async () => {
          executionOrder.push('002');
        }
      );
      const migration3 = new TestMigration(
        '003',
        'Third',
        async () => {},
        async () => {
          executionOrder.push('003');
        }
      );

      runner.addMigration(migration1);
      runner.addMigration(migration2);
      runner.addMigration(migration3);

      await runner.migrate();
      await runner.rollback();

      expect(executionOrder).toEqual(['003', '002', '001']);
    });

    it('should rollback to target version', async () => {
      const downFn1 = jest.fn(async () => {});
      const downFn2 = jest.fn(async () => {});
      const downFn3 = jest.fn(async () => {});

      const migration1 = new TestMigration('001', 'First', async () => {}, downFn1);
      const migration2 = new TestMigration('002', 'Second', async () => {}, downFn2);
      const migration3 = new TestMigration('003', 'Third', async () => {}, downFn3);

      runner.addMigration(migration1);
      runner.addMigration(migration2);
      runner.addMigration(migration3);

      await runner.migrate();
      await runner.rollback('001');

      expect(downFn3).toHaveBeenCalled();
      expect(downFn2).toHaveBeenCalled();
      expect(downFn1).not.toHaveBeenCalled();

      const applied = await runner.getAppliedMigrations();
      expect(applied).toHaveLength(1);
      expect(applied[0].version).toBe('001');
    });

    it('should wrap rollback in transaction', async () => {
      const mockProvider = provider as unknown as {
        _isTransactionActive: () => boolean;
      };
      let transactionActiveAtExecution = false;

      const downFn = jest.fn(async () => {
        transactionActiveAtExecution = mockProvider._isTransactionActive();
      });
      const migration = new TestMigration('001', 'Test', async () => {}, downFn);
      runner.addMigration(migration);

      await runner.migrate();
      await runner.rollback();

      expect(transactionActiveAtExecution).toBe(true);
      expect(mockProvider._isTransactionActive()).toBe(false);
    });

    it('should rollback transaction on failure', async () => {
      const downFn = jest.fn(async () => {
        throw new Error('Rollback failed');
      });
      const migration = new TestMigration('001', 'Test', async () => {}, downFn);
      runner.addMigration(migration);

      await runner.migrate();

      (provider.rollbackTransaction as jest.Mock).mockClear();

      await expect(runner.rollback()).rejects.toThrow(MigrationRollbackError);

      expect(provider.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should not remove record if rollback fails', async () => {
      const mockProvider = provider as unknown as {
        _getMigrations: () => Array<{ version: string; name: string; applied_at: string }>;
      };

      const downFn = jest.fn(async () => {
        throw new Error('Rollback failed');
      });
      const migration = new TestMigration('001', 'Test', async () => {}, downFn);
      runner.addMigration(migration);

      await runner.migrate();

      const beforeRollback = mockProvider._getMigrations().length;

      await expect(runner.rollback()).rejects.toThrow();

      const afterRollback = mockProvider._getMigrations().length;
      expect(afterRollback).toBe(beforeRollback);
    });
  });

  describe('transaction handling', () => {
    it('should commit transaction on successful migration', async () => {
      const migration = new TestMigration(
        '001',
        'Test',
        async () => {},
        async () => {}
      );
      runner.addMigration(migration);

      await runner.migrate();

      expect(provider.beginTransaction).toHaveBeenCalled();
      expect(provider.commitTransaction).toHaveBeenCalled();
      expect(provider.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should rollback transaction on migration error', async () => {
      const migration = new TestMigration(
        '001',
        'Test',
        async () => {
          throw new Error('Migration error');
        },
        async () => {}
      );
      runner.addMigration(migration);

      await expect(runner.migrate()).rejects.toThrow();

      expect(provider.beginTransaction).toHaveBeenCalled();
      expect(provider.rollbackTransaction).toHaveBeenCalled();
      expect(provider.commitTransaction).not.toHaveBeenCalled();
    });

    it('should commit transaction on successful rollback', async () => {
      const migration = new TestMigration(
        '001',
        'Test',
        async () => {},
        async () => {}
      );
      runner.addMigration(migration);

      await runner.migrate();

      (provider.commitTransaction as jest.Mock).mockClear();

      await runner.rollback();

      expect(provider.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty migration list', async () => {
      await expect(runner.migrate()).resolves.not.toThrow();
      await expect(runner.rollback()).resolves.not.toThrow();
    });

    it('should handle migration with async operations', async () => {
      const upFn = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await provider.executeNonQuery('CREATE TABLE async_test (id INTEGER)');
      });
      const migration = new TestMigration('001', 'AsyncTest', upFn, async () => {});
      runner.addMigration(migration);

      await runner.migrate();

      expect(upFn).toHaveBeenCalled();
    });

    it('should preserve migration order with string version comparison', async () => {
      const executionOrder: string[] = [];

      const migrations = [
        new TestMigration(
          '20250101_120000',
          'First',
          async () => {
            executionOrder.push('20250101_120000');
          },
          async () => {}
        ),
        new TestMigration(
          '20250102_120000',
          'Second',
          async () => {
            executionOrder.push('20250102_120000');
          },
          async () => {}
        ),
        new TestMigration(
          '20250103_120000',
          'Third',
          async () => {
            executionOrder.push('20250103_120000');
          },
          async () => {}
        )
      ];

      migrations.forEach((m) => runner.addMigration(m));

      await runner.migrate();

      expect(executionOrder).toEqual(['20250101_120000', '20250102_120000', '20250103_120000']);
    });
  });
});
