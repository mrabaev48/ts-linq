import type { DatabaseProvider } from '@ts-linq/core';
import { SchemaApplyCommand } from '../src/commands/SchemaApplyCommand';
import * as migrations from '@ts-linq/migrations';

jest.mock('@ts-linq/migrations');

describe('Schema Apply - Destructive Change Protection', () => {
  let mockProvider: jest.Mocked<Partial<DatabaseProvider>>;
  let mockLogger: any;
  let mockFs: any;
  let executedQueries: string[];

  beforeEach(() => {
    executedQueries = [];
    process.exitCode = 0;

    mockProvider = {
      providerLabel: 'postgresql',
      executeNonQuery: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
        return 1;
      }),
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockFs = {
      exists: jest.fn(() => true),
      readText: jest.fn(() => JSON.stringify({
        tables: [
          {
            name: 'Users',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false },
              { name: 'name', type: 'TEXT', nullable: false }
            ],
            primaryKeys: ['id'],
            indexes: [],
            foreignKeys: []
          }
        ]
      })),
      writeText: jest.fn(),
      ensureDir: jest.fn(),
      readDir: jest.fn(() => [])
    };

    (migrations.SchemaSnapshotSerializer as jest.Mock).mockImplementation(() => ({
      deserialize: jest.fn((json: string) => JSON.parse(json)),
      serialize: jest.fn((obj: any) => JSON.stringify(obj))
    }));

    (migrations.SchemaSnapshotBuilder as jest.Mock).mockImplementation(() => ({
      buildActualFromProvider: jest.fn(async () => ({
        tables: [
          {
            name: 'Users',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false },
              { name: 'name', type: 'TEXT', nullable: false },
              { name: 'email', type: 'TEXT', nullable: true }
            ],
            primaryKeys: ['id'],
            indexes: [],
            foreignKeys: []
          }
        ]
      })),
      buildExpectedFromMetadata: jest.fn()
    }));

    (migrations.compareSchemas as jest.Mock).mockReturnValue({
      added: [],
      removed: [],
      modified: []
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DROP TABLE protection', () => {
    test('prevents execution without --force flag', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: ['DROP TABLE OldUsers;'],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        '/tmp/schema.json'
      ]);

      expect(process.exitCode).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Destructive change detected')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('--force')
      );
      expect(mockProvider.executeNonQuery).not.toHaveBeenCalled();
      expect(executedQueries).toHaveLength(0);
    });

    test('executes with --force flag', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: ['DROP TABLE OldUsers;'],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        '/tmp/schema.json',
        '--force'
      ]);

      expect(process.exitCode).not.toBe(2);
      expect(mockProvider.executeNonQuery).toHaveBeenCalledWith('DROP TABLE OldUsers;');
      expect(executedQueries).toContain('DROP TABLE OldUsers;');
      expect(mockLogger.info).toHaveBeenCalledWith('Applied 1 step(s) from snapshot');
    });
  });

  describe('DELETE statement protection', () => {
    test('prevents DELETE without --force', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: ['DELETE FROM Users WHERE inactive = 1;'],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        '/tmp/schema.json'
      ]);

      expect(process.exitCode).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(executedQueries).toHaveLength(0);
    });

    test('executes DELETE with --force', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: ['DELETE FROM Users WHERE inactive = 1;'],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        '/tmp/schema.json',
        '--force'
      ]);

      expect(process.exitCode).not.toBe(2);
      expect(executedQueries).toContain('DELETE FROM Users WHERE inactive = 1;');
    });
  });

  describe('Non-destructive changes', () => {
    test('executes safe migrations without --force', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: [
          'CREATE TABLE Posts (id INTEGER PRIMARY KEY, title TEXT);',
          'ALTER TABLE Users ADD COLUMN created_at DATETIME;',
          'CREATE INDEX idx_users_email ON Users(email);'
        ],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        '/tmp/schema.json'
      ]);

      expect(process.exitCode).not.toBe(2);
      expect(executedQueries).toHaveLength(3);
      expect(executedQueries[0]).toContain('CREATE TABLE Posts');
      expect(executedQueries[1]).toContain('ALTER TABLE Users ADD');
      expect(executedQueries[2]).toContain('CREATE INDEX');
      expect(mockLogger.info).toHaveBeenCalledWith('Applied 3 step(s) from snapshot');
    });
  });

  describe('Dry-run mode', () => {
    test('logs destructive SQL without executing when --dry-run provided', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: [
          'DROP TABLE OldUsers;',
          'CREATE TABLE NewUsers (id INTEGER);'
        ],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        '/tmp/schema.json',
        '--dry-run'
      ]);

      expect(mockLogger.info).toHaveBeenCalledWith('DROP TABLE OldUsers;');
      expect(mockLogger.info).toHaveBeenCalledWith('CREATE TABLE NewUsers (id INTEGER);');
      expect(mockProvider.executeNonQuery).not.toHaveBeenCalled();
      expect(executedQueries).toHaveLength(0);
    });

    test('does not require --force in dry-run mode', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: ['DROP TABLE Users;'],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        '/tmp/schema.json',
        '--dry-run'
      ]);

      expect(process.exitCode).not.toBe(2);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('DROP TABLE Users;');
    });
  });

  describe('Error handling', () => {
    test('fails when snapshot file does not exist', async () => {
      mockFs.exists = jest.fn(() => false);

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        '/nonexistent/schema.json'
      ]);

      expect(process.exitCode).toBe(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Snapshot file not found')
      );
      expect(mockProvider.executeNonQuery).not.toHaveBeenCalled();
    });
  });

  describe('Real-world scenarios', () => {
    test('production migration: adds column and index safely', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: [
          'ALTER TABLE Users ADD COLUMN email VARCHAR(255);',
          'CREATE INDEX idx_users_email ON Users(email);',
          'UPDATE Users SET email = name || \'@example.com\';'
        ],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        'prod-schema.json'
      ]);

      expect(process.exitCode).not.toBe(2);
      expect(executedQueries).toHaveLength(3);
      expect(mockLogger.info).toHaveBeenCalledWith('Applied 3 step(s) from snapshot');
    });

    test('production migration: prevents accidental table drop', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: [
          'DROP TABLE Users;',
          '-- Migrate data',
          'CREATE TABLE NewUsers (id INTEGER);'
        ],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        'prod-schema.json'
      ]);

      expect(process.exitCode).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Destructive change detected')
      );
      expect(executedQueries).toHaveLength(0);
    });

    test('confirmed destructive migration with explicit --force', async () => {
      (migrations.generateMigrationFromDiff as jest.Mock).mockReturnValue({
        up: [
          'DROP TABLE deprecated_table;',
          'DELETE FROM logs WHERE created_at < \'2023-01-01\';'
        ],
        down: []
      });

      const cmd = new SchemaApplyCommand(mockLogger, mockFs);
      await cmd.runDb(mockProvider as DatabaseProvider, [
        'schema:apply',
        'cleanup-schema.json',
        '--force'
      ]);

      expect(process.exitCode).not.toBe(2);
      expect(executedQueries).toEqual([
        'DROP TABLE deprecated_table;',
        'DELETE FROM logs WHERE created_at < \'2023-01-01\';'
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith('Applied 2 step(s) from snapshot');
    });
  });
});
