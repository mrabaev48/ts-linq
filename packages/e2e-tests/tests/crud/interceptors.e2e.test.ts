import 'reflect-metadata';

import {
  type CommandEventData,
  type DbCommand,
  type DbReader,
  type IDbCommandInterceptor,
  InterceptionResult,
  type ISaveChangesInterceptor,
  type SaveChangesEventData
} from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext, DbContextOptionsBuilder } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

// ── Fixtures ──────────────────────────────────────────────────────────────────

@Entity({ name: 'ic_e2e_items' })
class IcE2eItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  label!: string;
}

class IcE2eContext extends DbContext {
  items = this.set(IcE2eItem);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const run = process.env.SKIP_DB_TESTS !== '1';

(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E Interceptors - %s',
  (providerName) => {
    let harness: any;

    let provider: any;
    let ctx: IcE2eContext;

    beforeEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      ({ harness, provider } = await setupTestDatabase(
        providerName as 'postgresql' | 'mysql' | 'mssql'
      ));
    });

    afterEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      await ctx?.dispose?.();
      await dropTables(provider, ['ic_e2e_items']);
      await teardownTestDatabase(harness);
    });

    // ── IDbCommandInterceptor ──────────────────────────────────────────────

    it('IDbCommandInterceptor.nonQueryExecuted captures SQL statements', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const capturedSql: string[] = [];

      const commandIc: IDbCommandInterceptor = {
        nonQueryExecuted(cmd: DbCommand, _ev: CommandEventData, result: number): number {
          capturedSql.push(cmd.sql);
          return result;
        }
      };

      const opts = new DbContextOptionsBuilder({ provider }).addInterceptors(commandIc).build();

      ctx = new IcE2eContext(opts);
      await ctx.ensureCreated();
      capturedSql.length = 0; // reset after CREATE TABLE

      const item = new IcE2eItem();
      item.label = 'probe';
      ctx.items.add(item);
      await ctx.saveChanges();

      // At minimum the INSERT should have been captured
      const hasInsert = capturedSql.some((s) => /INSERT/i.test(s));
      expect(hasInsert).toBe(true);
    });

    it('IDbCommandInterceptor.readerExecuted captures SELECT results', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const capturedSql: string[] = [];

      const commandIc: IDbCommandInterceptor = {
        readerExecuted(cmd: DbCommand, _ev: CommandEventData, result: DbReader): DbReader {
          capturedSql.push(cmd.sql);
          return result;
        }
      };

      const opts = new DbContextOptionsBuilder({ provider }).addInterceptors(commandIc).build();

      ctx = new IcE2eContext(opts);
      await ctx.ensureCreated();
      capturedSql.length = 0;

      const item = new IcE2eItem();
      item.label = 'select-probe';
      ctx.items.add(item);
      await ctx.saveChanges();

      await ctx.items.toArray();

      const hasSelect = capturedSql.some((s) => /SELECT/i.test(s));
      expect(hasSelect).toBe(true);
    });

    // ── ISaveChangesInterceptor ────────────────────────────────────────────

    it('ISaveChangesInterceptor.savingChanges fires before INSERT on real DB', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      let savingCalled = false;
      const ic: ISaveChangesInterceptor = {
        savingChanges(ev: SaveChangesEventData, result: InterceptionResult<number>) {
          savingCalled = true;
          expect(ev.entries?.length).toBeGreaterThan(0);
          return result;
        }
      };

      const opts = new DbContextOptionsBuilder({ provider }).addInterceptors(ic).build();
      ctx = new IcE2eContext(opts);
      await ctx.ensureCreated();

      const item = new IcE2eItem();
      item.label = 'real-insert';
      ctx.items.add(item);
      await ctx.saveChanges();

      expect(savingCalled).toBe(true);

      // Verify data was actually persisted despite interception
      const rows = await ctx.items.toArray();
      expect(rows.some((r) => r.label === 'real-insert')).toBe(true);
    });

    it('ISaveChangesInterceptor.SuppressWithResult skips DML on real DB', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const ic: ISaveChangesInterceptor = {
        savingChanges(
          _ev: SaveChangesEventData,
          _result: InterceptionResult<number>
        ): InterceptionResult<number> {
          return InterceptionResult.SuppressWithResult<number>(0);
        }
      };

      const opts = new DbContextOptionsBuilder({ provider }).addInterceptors(ic).build();
      ctx = new IcE2eContext(opts);
      await ctx.ensureCreated();

      const item = new IcE2eItem();
      item.label = 'never-persisted';
      ctx.items.add(item);

      const result = await ctx.saveChanges();
      expect(result).toBe(0);

      // Row must NOT be in the database
      const rows = await ctx.items.toArray();
      expect(rows.every((r) => r.label !== 'never-persisted')).toBe(true);
    });

    it('ISaveChangesInterceptor.savedChanges receives final row count from real DB', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      let capturedCount: number | undefined;
      const ic: ISaveChangesInterceptor = {
        savedChanges(_ev: SaveChangesEventData, result: number) {
          capturedCount = result;
          return result;
        }
      };

      const opts = new DbContextOptionsBuilder({ provider }).addInterceptors(ic).build();
      ctx = new IcE2eContext(opts);
      await ctx.ensureCreated();

      ctx.items.add(Object.assign(new IcE2eItem(), { label: 'x' }));
      ctx.items.add(Object.assign(new IcE2eItem(), { label: 'y' }));
      await ctx.saveChanges();

      expect(capturedCount).toBeGreaterThan(0);
    });
  }
);
