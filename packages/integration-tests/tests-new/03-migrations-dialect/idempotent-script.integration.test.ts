import { Column, Entity, MetadataStorage, PrimaryKey } from '@ts-linq/metadata';
import type { IdempotentMigrationStep } from '@ts-linq/migrations';
import { IdempotentEmitter, ModelSnapshotBuilder, ModelSnapshotDiff } from '@ts-linq/migrations';

/**
 * Integration tests for the IdempotentEmitter and ModelSnapshot subsystems.
 * These tests run without a live database — they validate the SQL generation
 * and model-diffing logic by inspecting the emitted SQL strings.
 */
describe('Idempotent Script + Model Snapshot — integration (no DB)', () => {
  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  // -------------------------------------------------------------------------
  // IdempotentEmitter: SQL structure
  // -------------------------------------------------------------------------

  describe('IdempotentEmitter.emit()', () => {
    const emitter = new IdempotentEmitter();

    const steps: IdempotentMigrationStep[] = [
      {
        version: '20241201000000',
        name: 'CreateUsers',
        upSql: ['CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT)']
      },
      {
        version: '20241202000000',
        name: 'AddUserIndex',
        upSql: ['CREATE INDEX idx_users_email ON users (email)']
      }
    ];

    describe('PostgreSQL output', () => {
      it('produces valid idempotent SQL containing both migrations', () => {
        const sql = emitter.emit(steps, 'postgresql');

        expect(sql).toContain('CREATE TABLE IF NOT EXISTS __migrations');
        expect(sql).toContain('20241201000000');
        expect(sql).toContain('20241202000000');
        expect(sql).toContain('CREATE TABLE users');
        expect(sql).toContain('CREATE INDEX idx_users_email');
      });

      it('includes INSERT INTO __migrations for each step', () => {
        const sql = emitter.emit(steps, 'postgresql');

        const insertCount = (sql.match(/INSERT INTO __migrations/g) ?? []).length;
        expect(insertCount).toBe(2);
      });

      it('is idempotent by guard structure (re-running checks version before applying)', () => {
        const sql = emitter.emit(steps, 'postgresql');

        // Each migration has its own version guard
        expect(sql).toContain("WHERE version = '20241201000000'");
        expect(sql).toContain("WHERE version = '20241202000000'");
      });

      it('emits steps in order', () => {
        const sql = emitter.emit(steps, 'postgresql');

        const idx1 = sql.indexOf('20241201000000');
        const idx2 = sql.indexOf('20241202000000');
        expect(idx1).toBeLessThan(idx2);
      });
    });

    describe('SQL Server output', () => {
      it('produces valid T-SQL with IF NOT EXISTS guards (no GO separator)', () => {
        const sql = emitter.emit(steps, 'mssql');

        expect(sql).toContain('IF NOT EXISTS');
        expect(sql).toContain('BEGIN');
        expect(sql).toContain('END');
        // GO is a SSMS batch separator — must not appear for programmatic execution
        expect(sql).not.toContain('GO');
      });

      it('includes CONVERT for applied_at timestamp', () => {
        const sql = emitter.emit(steps, 'mssql');

        expect(sql).toContain('CONVERT(VARCHAR(50), GETDATE(), 126)');
      });

      it('emitStatements returns one statement per block', () => {
        const stmts = emitter.emitStatements(steps, 'mssql');
        // header + one IF block per step
        expect(stmts).toHaveLength(1 + steps.length);
      });
    });

    describe('MySQL output', () => {
      it('uses INSERT IGNORE without DELIMITER (programmatic-safe)', () => {
        const sql = emitter.emit(steps, 'mysql');

        expect(sql).toContain('INSERT IGNORE INTO __migrations');
        expect(sql).not.toContain('DELIMITER');
        expect(sql).not.toContain('CREATE PROCEDURE');
      });

      it('emitStatements returns header + ddl + INSERT IGNORE per step', () => {
        const singleStepList: IdempotentMigrationStep[] = [steps[0]];
        const stmts = emitter.emitStatements(singleStepList, 'mysql');
        // header + 1 DDL + INSERT IGNORE = 3
        expect(stmts).toHaveLength(3);
      });
    });
  });

  // -------------------------------------------------------------------------
  // ModelSnapshotBuilder + ModelSnapshotDiff: change detection
  // -------------------------------------------------------------------------

  describe('ModelSnapshot — drift detection via real metadata decorators', () => {
    it('detects no drift when model matches stored snapshot', () => {
      @Entity({ name: 'articles' })
      class Article {
        @PrimaryKey()
        id!: number;

        @Column({ type: 'TEXT', nullable: false })
        title!: string;
      }

      const builder = new ModelSnapshotBuilder();
      const snapshot = builder.buildFromMetadata();

      // Simulate "stored snapshot" = same as current model
      const diff = new ModelSnapshotDiff().compare(snapshot, snapshot);

      expect(diff.hasDifferences).toBe(false);
    });

    it('detects a new table added to the model', () => {
      @Entity({ name: 'products' })
      class Product {
        @PrimaryKey()
        id!: number;

        @Column({ type: 'TEXT' })
        sku!: string;
      }

      const builder = new ModelSnapshotBuilder();

      // "Stored" snapshot without Product
      const stored = { version: 1 as const, tables: [] };

      // Current snapshot with Product
      const current = builder.buildFromMetadata();

      const diff = new ModelSnapshotDiff().compare(stored, current);

      expect(diff.hasDifferences).toBe(true);
      const tableDiff = diff.tableDiffs.find((d) => d.table === 'products');
      expect(tableDiff?.kind).toBe('added');
    });

    it('detects a column added to an existing table', () => {
      @Entity({ name: 'categories' })
      class Category {
        @PrimaryKey()
        id!: number;

        @Column({ type: 'TEXT' })
        name!: string;
      }

      const builder = new ModelSnapshotBuilder();

      // Stored snapshot: categories table but without the "name" column
      const stored = {
        version: 1 as const,
        tables: [
          {
            name: 'categories',
            columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }],
            primaryKeys: ['id'],
            indexes: []
          }
        ]
      };

      const current = builder.buildFromMetadata();

      const diff = new ModelSnapshotDiff().compare(stored, current);

      expect(diff.hasDifferences).toBe(true);
      const tableDiff = diff.tableDiffs.find((d) => d.table === 'categories');
      expect(tableDiff?.kind).toBe('changed');
      const colDiff = tableDiff?.columnDiffs?.find((c) => c.column === 'name');
      expect(colDiff?.kind).toBe('added');
    });

    it('produces a stable, sorted snapshot that is consistent across multiple calls', () => {
      @Entity({ name: 'orders' })
      class Order {
        @PrimaryKey()
        id!: number;

        @Column({ type: 'INTEGER' })
        customerId!: number;

        @Column({ type: 'TEXT' })
        status!: string;
      }

      const builder = new ModelSnapshotBuilder();
      const snap1 = builder.buildFromMetadata();
      const snap2 = builder.buildFromMetadata();

      expect(JSON.stringify(snap1)).toBe(JSON.stringify(snap2));
    });
  });
});
