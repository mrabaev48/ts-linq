import type { SqlDialect } from '@ts-linq/types';

import {
  batchDeleteCases,
  batchInsertCases,
  batchUpdateCases,
  bulkDeleteCases,
  bulkUpdateCases,
  type ContractCase,
  deleteCases,
  insertCases,
  selectCases,
  updateCases
} from './cases';
import { batchMeta, clearContractEntity, registerContractEntity } from './fixtures';
import type { SqlDialectContractGolden } from './goldenTypes';

/**
 * Parameterized contract test (one suite, N implementations) asserting that a {@link SqlDialect} is
 * a valid Liskov substitute: given the shared case matrix, its output matches the supplied per-dialect
 * golden data. This is the safety net that makes the dialect dedup refactors (task-1..task-5) safe —
 * any structural drift in a dialect's SQL surfaces as a golden diff.
 *
 * @param makeDialect Factory producing a fresh dialect instance (called once).
 * @param golden      The dialect's golden expectations, keyed by case id per method group.
 */
export function runSqlDialectContract(
  makeDialect: () => SqlDialect,
  golden: SqlDialectContractGolden
): void {
  const dialect = makeDialect();

  describe('SqlDialect contract', () => {
    beforeEach(() => {
      // `buildSelect` resolves the table name via the global metadata storage.
      registerContractEntity();
    });

    afterEach(() => {
      clearContractEntity();
    });

    describe('golden completeness', () => {
      const groups: ReadonlyArray<
        [string, ReadonlyArray<ContractCase<unknown>>, Readonly<Record<string, unknown>>]
      > = [
        ['select', selectCases, golden.select],
        ['insert', insertCases, golden.insert],
        ['update', updateCases, golden.update],
        ['delete', deleteCases, golden.delete],
        ['bulkUpdate', bulkUpdateCases, golden.bulkUpdate],
        ['bulkDelete', bulkDeleteCases, golden.bulkDelete],
        ['batchInsert', batchInsertCases, golden.batchInsert],
        ['batchUpdate', batchUpdateCases, golden.batchUpdate],
        ['batchDelete', batchDeleteCases, golden.batchDelete]
      ];

      for (const [name, cases, map] of groups) {
        it(`${name} golden covers exactly the declared cases`, () => {
          expect(Object.keys(map).sort()).toEqual(cases.map((c) => c.id).sort());
        });
      }
    });

    describe('parameterLimit', () => {
      it('matches the declared limit', () => {
        expect(dialect.parameterLimit).toBe(golden.parameterLimit);
      });
    });

    runGroup('buildSelect', selectCases, golden.select, makeDialect);
    runGroup('buildInsert', insertCases, golden.insert, makeDialect);
    runGroup('buildUpdate', updateCases, golden.update, makeDialect);
    runGroup('buildDelete', deleteCases, golden.delete, makeDialect);
    runGroup('buildBulkUpdate', bulkUpdateCases, golden.bulkUpdate, makeDialect);
    runGroup('buildBulkDelete', bulkDeleteCases, golden.bulkDelete, makeDialect);
    runGroup('buildBatchInsert', batchInsertCases, golden.batchInsert, makeDialect);
    runGroup('buildBatchUpdate', batchUpdateCases, golden.batchUpdate, makeDialect);
    runGroup('buildBatchDelete', batchDeleteCases, golden.batchDelete, makeDialect);

    describe('uniform error contract', () => {
      const noPkMeta = { ...batchMeta, primaryKeys: [] };

      it('buildBatchInsert throws on an empty entity list', () => {
        const d = makeDialect();
        expect(() => d.buildBatchInsert?.([], batchMeta)).toThrow(/empty entity list/i);
      });

      it('buildBatchUpdate throws on an empty entity list', () => {
        const d = makeDialect();
        expect(() => d.buildBatchUpdate?.([], batchMeta)).toThrow(/empty entity list/i);
      });

      it('buildBatchUpdate throws when no primary key is defined', () => {
        const d = makeDialect();
        expect(() => d.buildBatchUpdate?.([{ name: 'X' }], noPkMeta)).toThrow(/no primary key/i);
      });

      it('buildBatchDelete throws on an empty entity list', () => {
        const d = makeDialect();
        expect(() => d.buildBatchDelete?.([], batchMeta)).toThrow(/empty entity list/i);
      });

      it('buildBatchDelete throws when no primary key is defined', () => {
        const d = makeDialect();
        expect(() => d.buildBatchDelete?.([{ id: 1 }], noPkMeta)).toThrow(/no primary key/i);
      });
    });
  });
}

function runGroup<R>(
  method: string,
  cases: ReadonlyArray<ContractCase<R>>,
  golden: Readonly<Record<string, R>>,
  makeDialect: () => SqlDialect
): void {
  describe(method, () => {
    for (const c of cases) {
      it(`${c.id} matches golden`, () => {
        const expected = golden[c.id];
        expect(expected).toBeDefined();
        expect(c.invoke(makeDialect())).toEqual(expected);
      });
    }
  });
}
