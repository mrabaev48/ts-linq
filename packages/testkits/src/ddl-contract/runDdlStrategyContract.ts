import type { DdlStrategy } from '@ts-linq/types';

import {
  addColumnCases,
  addUniqueConstraintCases,
  alterColumnTypeCases,
  columnDefinitionCases,
  commentCases,
  createIndexCases,
  createTableCases,
  type DdlCase,
  dropColumnCases,
  dropUniqueConstraintCases,
  foreignKeyCases,
  renameTableCases
} from './cases';
import type { DdlStrategyContractGolden } from './goldenTypes';

/**
 * Parameterized DDL contract test (one suite, N implementations) asserting that a {@link DdlStrategy}
 * is a valid Liskov substitute: given the shared case matrix, its output matches the supplied
 * per-dialect golden data. The DDL mirror of `runSqlDialectContract` — the safety net that makes the
 * DDL dedup refactor (task-7) safe: any structural drift in a dialect's DDL surfaces as a golden diff.
 *
 * @param makeStrategy Factory producing a fresh strategy instance (called per assertion).
 * @param golden       The dialect's golden expectations, keyed by case id per DDL operation.
 */
export function runDdlStrategyContract(
  makeStrategy: () => DdlStrategy,
  golden: DdlStrategyContractGolden
): void {
  describe('DdlStrategy contract', () => {
    describe('golden completeness', () => {
      const groups: ReadonlyArray<
        [string, ReadonlyArray<DdlCase<unknown>>, Readonly<Record<string, unknown>>]
      > = [
        ['createTable', createTableCases, golden.createTable],
        ['columnDefinition', columnDefinitionCases, golden.columnDefinition],
        ['createIndex', createIndexCases, golden.createIndex],
        ['addColumn', addColumnCases, golden.addColumn],
        ['dropColumn', dropColumnCases, golden.dropColumn],
        ['alterColumnType', alterColumnTypeCases, golden.alterColumnType],
        ['renameTable', renameTableCases, golden.renameTable],
        ['foreignKey', foreignKeyCases, golden.foreignKey],
        ['addUniqueConstraint', addUniqueConstraintCases, golden.addUniqueConstraint],
        ['dropUniqueConstraint', dropUniqueConstraintCases, golden.dropUniqueConstraint],
        ['comment', commentCases, golden.comment]
      ];

      for (const [name, cases, map] of groups) {
        it(`${name} golden covers exactly the declared cases`, () => {
          expect(Object.keys(map).sort()).toEqual(cases.map((c) => c.id).sort());
        });
      }
    });

    runGroup('generateCreateTableSql', createTableCases, golden.createTable, makeStrategy);
    runGroup(
      'generateColumnDefinition',
      columnDefinitionCases,
      golden.columnDefinition,
      makeStrategy
    );
    runGroup('generateCreateIndexSql', createIndexCases, golden.createIndex, makeStrategy);
    runGroup('generateAddColumnSql', addColumnCases, golden.addColumn, makeStrategy);
    runGroup('generateDropColumnSql', dropColumnCases, golden.dropColumn, makeStrategy);
    runGroup(
      'generateAlterColumnTypeSql',
      alterColumnTypeCases,
      golden.alterColumnType,
      makeStrategy
    );
    runGroup('generateRenameTableSql', renameTableCases, golden.renameTable, makeStrategy);
    runGroup('generateForeignKeySql', foreignKeyCases, golden.foreignKey, makeStrategy);
    runGroup(
      'generateAddUniqueConstraintSql',
      addUniqueConstraintCases,
      golden.addUniqueConstraint,
      makeStrategy
    );
    runGroup(
      'generateDropUniqueConstraintSql',
      dropUniqueConstraintCases,
      golden.dropUniqueConstraint,
      makeStrategy
    );
    runGroup('generateCommentSql', commentCases, golden.comment, makeStrategy);
  });
}

function runGroup<R>(
  method: string,
  cases: ReadonlyArray<DdlCase<R>>,
  golden: Readonly<Record<string, R>>,
  makeStrategy: () => DdlStrategy
): void {
  describe(method, () => {
    for (const c of cases) {
      it(`${c.id} matches golden`, () => {
        const expected = golden[c.id];
        expect(expected).toBeDefined();
        expect(c.invoke(makeStrategy())).toEqual(expected);
      });
    }
  });
}
