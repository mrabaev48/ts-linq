'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.StepPlanner = void 0;
const DiffTypes_1 = require('../DiffTypes');
const DialectMigrationSql_1 = require('../DialectMigrationSql');
class StepPlanner {
  plan(expected, actual, dialect) {
    const diff = (0, DiffTypes_1.compareSchemas)(expected, actual);
    const rendered = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, dialect);
    return rendered.up;
  }
}
exports.StepPlanner = StepPlanner;
//# sourceMappingURL=StepPlanner.js.map
