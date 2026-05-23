import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { DatabaseProvider } from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import type { IdempotentMigrationStep } from '@ts-linq/migrations';
import {
  IdempotentEmitter,
  Migration,
  MigrationRunner,
  ModelSnapshotBuilder,
  ModelSnapshotDiff,
  ModelSnapshotSerializer
} from '@ts-linq/migrations';
import { DbContextOptionsBuilder } from '@ts-linq/orm';

import { setupTestDatabase, teardownTestDatabase } from '../../src/setup';

// ---------------------------------------------------------------------------
// Entity setup (isolated from global metadata)
// ---------------------------------------------------------------------------

@Entity({ name: 'e2e_migration_items' })
class MigrationItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT', nullable: false })
  label!: string;
}

// ---------------------------------------------------------------------------
// Concrete migration
// ---------------------------------------------------------------------------

class CreateMigrationItemsTable extends Migration {
  protected get version(): string {
    return '20241201000001';
  }

  protected get name(): string {
    return 'CreateMigrationItemsTable';
  }

  private _provider!: DatabaseProvider;

  setProvider(p: DatabaseProvider): void {
    this._provider = p;
  }

  async up(): Promise<void> {
    await this._provider.executeNonQuery(
      `CREATE TABLE IF NOT EXISTS e2e_migration_items (
        id INTEGER PRIMARY KEY ${this._isPostgres ? 'GENERATED ALWAYS AS IDENTITY' : 'AUTOINCREMENT'},
        label TEXT NOT NULL
      )`
    );
  }

  async down(): Promise<void> {
    await this._provider.executeNonQuery('DROP TABLE IF EXISTS e2e_migration_items');
  }

  private get _isPostgres(): boolean {
    return (this._provider?.providerLabel ?? '') === 'postgresql';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempMigrationsDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-e2e-migrations-'));
}

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

  const sql = new IdempotentEmitter().emit(steps, dialect);
  await provider.executeNonQuery(sql);
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
    let harness: any;
    let provider: DatabaseProvider;

    beforeEach(async () => {
      ({ harness, provider } = await setupTestDatabase(
        providerName as 'postgresql' | 'mysql' | 'mssql'
      ));
    });

    afterEach(async () => {
      await teardownTestDatabase(harness);
    });

    // -----------------------------------------------------------------------
    // MigrationRunner: basic apply + idempotency
    // -----------------------------------------------------------------------

    describe('MigrationRunner', () => {
      it('applies a migration and records it in __migrations', async () => {
        const migration = new CreateMigrationItemsTable();
        migration.setProvider(provider);

        const runner = new MigrationRunner(provider);
        runner.addMigration(migration);

        await runner.migrate();

        const applied = await runner.getAppliedMigrations();
        expect(applied).toHaveLength(1);
        expect(applied[0].version).toBe('20241201000001');
      });

      it('does not re-apply an already applied migration', async () => {
        const migration = new CreateMigrationItemsTable();
        migration.setProvider(provider);

        const runner = new MigrationRunner(provider);
        runner.addMigration(migration);

        await runner.migrate();
        await runner.migrate(); // second run — should be no-op

        const applied = await runner.getAppliedMigrations();
        expect(applied).toHaveLength(1);
      });
    });

    // -----------------------------------------------------------------------
    // Idempotent SQL script: apply + re-apply
    // -----------------------------------------------------------------------

    describe('IdempotentEmitter: re-runnable SQL script', () => {
      it('applies idempotent SQL and records migration; re-run is safe', async () => {
        const steps: IdempotentMigrationStep[] = [
          {
            version: '20241201000002',
            name: 'CreateIdempotentTestTable',
            upSql: [
              `CREATE TABLE IF NOT EXISTS e2e_idempotent_test (
                id INTEGER,
                value TEXT
              )`
            ]
          }
        ];

        // First run: creates table and inserts migration record
        await applyIdempotentScript(provider, steps);

        // Verify migration was recorded
        const runner = new MigrationRunner(provider);
        const applied = await runner.getAppliedMigrations();
        const found = applied.find((m: { version: string }) => m.version === '20241201000002');
        expect(found).toBeDefined();

        // Second run: should be a no-op (guard prevents re-execution)
        await expect(applyIdempotentScript(provider, steps)).resolves.not.toThrow();

        // Still only one record
        const appliedAfter = await runner.getAppliedMigrations();
        const count = appliedAfter.filter(
          (m: { version: string }) => m.version === '20241201000002'
        ).length;
        expect(count).toBe(1);
      });
    });

    // -----------------------------------------------------------------------
    // ModelSnapshot: hasPendingModelChanges logic (via direct API)
    // -----------------------------------------------------------------------

    describe('ModelSnapshot: drift detection', () => {
      let tempDir: string;

      beforeEach(() => {
        tempDir = createTempMigrationsDir();
      });

      afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      });

      it('reports no drift when stored snapshot matches current model', () => {
        const builder = new ModelSnapshotBuilder();
        const current = builder.buildFromMetadata();

        // Store the snapshot to disk
        const serializer = new ModelSnapshotSerializer();
        const snapshotPath = path.join(tempDir, 'model.snapshot.json');
        fs.writeFileSync(snapshotPath, serializer.serialize(current), 'utf8');

        // Load and compare
        const stored = serializer.deserialize(fs.readFileSync(snapshotPath, 'utf8'));
        const diff = new ModelSnapshotDiff().compare(stored, current);

        expect(diff.hasDifferences).toBe(false);
      });

      it('reports drift when a column is added to the current model vs stored snapshot', () => {
        const builder = new ModelSnapshotBuilder();
        const current = builder.buildFromMetadata();

        // Store a version WITHOUT one of the columns
        const stored = {
          version: 1 as const,
          tables: current.tables.map((t: import('@ts-linq/migrations').ModelTableSnapshot) => ({
            ...t,
            columns: t.columns.filter(
              (c: import('@ts-linq/migrations').ModelColumnSnapshot) => c.name !== 'label'
            )
          }))
        };

        const diff = new ModelSnapshotDiff().compare(stored, current);

        // If MigrationItem entity is registered, there should be drift
        const hasLabel = current.tables
          .find(
            (t: import('@ts-linq/migrations').ModelTableSnapshot) =>
              t.name === 'e2e_migration_items'
          )
          ?.columns.some((c) => c.name === 'label');

        if (hasLabel) {
          expect(diff.hasDifferences).toBe(true);
        }
      });

      it('DbContextOptionsBuilder.migrations() sets migrationsDirectory on built options', () => {
        const builderOptions = new DbContextOptionsBuilder({
          provider: provider as unknown as import('@ts-linq/core').DbContextOptions['provider']
        })
          .migrations({ directory: tempDir })
          .build();

        expect(builderOptions.migrationsDirectory).toBe(tempDir);
      });
    });
  }
);
