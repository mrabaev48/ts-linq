import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { DatabaseProvider } from '@ts-linq/core';
import type { IdempotentMigrationStep } from '@ts-linq/migrations';
import {
  IdempotentEmitter,
  MigrationRunner,
  ModelSnapshotBuilder,
  ModelSnapshotDiff,
  ModelSnapshotSerializer
} from '@ts-linq/migrations';
import { DbContextOptionsBuilder } from '@ts-linq/orm';
import type { DatabaseHarness } from '@ts-linq/testkits';

import { setupTestDatabase, teardownTestDatabase } from '../../src/setup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Execute an idempotent script against a live database.
 * Uses `emitStatements()` to send each statement individually — required
 * because programmatic drivers do not support `GO` (SQL Server) or
 * `DELIMITER` (MySQL) client commands.
 */
async function applyIdempotentScript(
  provider: DatabaseProvider,
  steps: IdempotentMigrationStep[]
): Promise<void> {
  const dialect = (() => {
    const label = provider.providerLabel;
    if (label === 'mysql') return 'mysql' as const;
    if (label === 'mssql') return 'mssql' as const;
    return 'postgresql' as const;
  })();

  const statements = new IdempotentEmitter().emitStatements(steps, dialect);
  for (const stmt of statements) {
    const trimmed = stmt.replace(/^--[^\n]*\n/gm, '').trim();
    if (trimmed) {
      await provider.executeNonQuery(trimmed);
    }
  }
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-e2e-migrations-'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const run = process.env.SKIP_DB_TESTS !== '1';

(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  '[e2e][migrations] Idempotent migrations — %s',
  (providerName) => {
    let harness: DatabaseHarness;
    let provider: DatabaseProvider;

    beforeEach(async () => {
      const result = await setupTestDatabase(providerName as 'postgresql' | 'mysql' | 'mssql');
      harness = result.harness;
      provider = result.provider;
      // autoConnect: false in setup — connect explicitly before using provider directly
      await provider.connect();
    });

    afterEach(async () => {
      try {
        await provider.executeNonQuery('DROP TABLE IF EXISTS e2e_idempotent_test');
        await provider.executeNonQuery('DROP TABLE IF EXISTS __migrations');
      } catch {
        // cleanup best-effort
      }
      await provider.disconnect();
      await teardownTestDatabase(harness);
    });

    // -----------------------------------------------------------------------
    // MigrationRunner: table creation + history tracking
    // -----------------------------------------------------------------------

    describe('MigrationRunner — table management', () => {
      it('creates __migrations table without errors', async () => {
        const runner = new MigrationRunner(provider);
        await expect(runner.ensureMigrationTableExists()).resolves.not.toThrow();
      });

      it('returns empty list when no migrations have been applied', async () => {
        const runner = new MigrationRunner(provider);
        await runner.ensureMigrationTableExists();

        const applied = await runner.getAppliedMigrations();
        expect(applied).toHaveLength(0);
      });

      it('records a migration entry and reads it back', async () => {
        const runner = new MigrationRunner(provider);
        await runner.ensureMigrationTableExists();

        // Insert a migration record manually to verify round-trip without running actual DDL
        const insertSql =
          provider.providerLabel === 'mssql'
            ? `INSERT INTO __migrations (version, name, applied_at) VALUES ('20241201000001', 'TestMigration', '2024-12-01T00:00:00.000Z')`
            : `INSERT INTO __migrations (version, name, applied_at) VALUES ('20241201000001', 'TestMigration', '2024-12-01T00:00:00.000Z')`;

        await provider.executeNonQuery(insertSql);

        const applied = await runner.getAppliedMigrations();
        expect(applied).toHaveLength(1);
        expect(applied[0].version).toBe('20241201000001');
        expect(applied[0].name).toBe('TestMigration');
      });

      it('calling ensureMigrationTableExists twice does not throw', async () => {
        const runner = new MigrationRunner(provider);
        await runner.ensureMigrationTableExists();
        // Second call should be a no-op (IF NOT EXISTS / equivalent)
        await expect(runner.ensureMigrationTableExists()).resolves.not.toThrow();
      });
    });

    // -----------------------------------------------------------------------
    // IdempotentEmitter: re-runnable SQL execution
    // -----------------------------------------------------------------------

    describe('IdempotentEmitter — re-runnable execution', () => {
      /**
       * Returns a CREATE TABLE statement compatible with the current dialect.
       *
       * - PostgreSQL / MySQL: `CREATE TABLE IF NOT EXISTS` is valid.
       *   MySQL's idempotency relies on self-idempotent DDL (there is no guard
       *   block — only INSERT IGNORE at the end), so IF NOT EXISTS is required.
       * - MSSQL: `CREATE TABLE IF NOT EXISTS` is not valid T-SQL. Use plain
       *   `CREATE TABLE` — the `IF NOT EXISTS (SELECT 1 FROM __migrations …)`
       *   guard block already ensures the statement only runs once.
       */
      function makeCreateTableSql(provider: DatabaseProvider): string {
        return provider.providerLabel === 'mssql'
          ? 'CREATE TABLE e2e_idempotent_test (id INTEGER, value TEXT)'
          : 'CREATE TABLE IF NOT EXISTS e2e_idempotent_test (id INTEGER, value TEXT)';
      }

      it('creates __migrations table and records migration on first run', async () => {
        const steps: IdempotentMigrationStep[] = [
          {
            version: '20241201000002',
            name: 'CreateIdempotentTestTable',
            upSql: [makeCreateTableSql(provider)]
          }
        ];

        await applyIdempotentScript(provider, steps);

        const runner = new MigrationRunner(provider);
        const applied = await runner.getAppliedMigrations();
        const found = applied.find((m: { version: string }) => m.version === '20241201000002');
        expect(found).toBeDefined();
        expect(found?.name).toBe('CreateIdempotentTestTable');
      });

      it('re-run of idempotent script is safe (no duplicate migration records)', async () => {
        const steps: IdempotentMigrationStep[] = [
          {
            version: '20241201000002',
            name: 'CreateIdempotentTestTable',
            upSql: [makeCreateTableSql(provider)]
          }
        ];

        // First run
        await applyIdempotentScript(provider, steps);
        // Second run — must not throw or duplicate the migration record
        await expect(applyIdempotentScript(provider, steps)).resolves.not.toThrow();

        const runner = new MigrationRunner(provider);
        const applied = await runner.getAppliedMigrations();
        const count = applied.filter(
          (m: { version: string }) => m.version === '20241201000002'
        ).length;
        expect(count).toBe(1);
      });

      it('emitted script contains version guard', () => {
        const dialect = (() => {
          const label = provider.providerLabel;
          if (label === 'mysql') return 'mysql' as const;
          if (label === 'mssql') return 'mssql' as const;
          return 'postgresql' as const;
        })();

        const steps: IdempotentMigrationStep[] = [
          { version: '20241201000003', name: 'CheckGuard', upSql: ['SELECT 1'] }
        ];

        const sql = new IdempotentEmitter().emit(steps, dialect);

        expect(sql).toContain('20241201000003');
        expect(sql).toContain('__migrations');
      });
    });

    // -----------------------------------------------------------------------
    // ModelSnapshot: drift detection (pure in-memory — no DB access)
    // -----------------------------------------------------------------------

    describe('ModelSnapshot — drift detection (in-memory)', () => {
      let tempDir: string;

      beforeEach(() => {
        tempDir = createTempDir();
      });

      afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      });

      it('reports no drift when stored snapshot matches current model', () => {
        const builder = new ModelSnapshotBuilder();
        const current = builder.buildFromMetadata();

        const serializer = new ModelSnapshotSerializer();
        const snapshotPath = path.join(tempDir, 'model.snapshot.json');
        fs.writeFileSync(snapshotPath, serializer.serialize(current), 'utf8');

        const stored = serializer.deserialize(fs.readFileSync(snapshotPath, 'utf8'));
        const diff = new ModelSnapshotDiff().compare(stored, current);

        expect(diff.hasDifferences).toBe(false);
      });

      it('reports drift when stored snapshot is empty but model has tables', () => {
        const builder = new ModelSnapshotBuilder();
        const current = builder.buildFromMetadata();

        if (current.tables.length === 0) {
          // Skip when no entities are registered in the global metadata
          return;
        }

        const stored = { version: 1 as const, tables: [] };
        const diff = new ModelSnapshotDiff().compare(stored, current);

        expect(diff.hasDifferences).toBe(true);
      });

      it('DbContextOptionsBuilder.migrations() passes directory to built options', () => {
        const opts = new DbContextOptionsBuilder({
          provider: provider as unknown as import('@ts-linq/core').DbContextOptions['provider']
        })
          .migrations({ directory: tempDir })
          .build();

        expect(opts.migrationsDirectory).toBe(tempDir);
      });
    });
  }
);
