"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffMigrationGenerator = void 0;
const SchemaSnapshot_1 = require("./SchemaSnapshot");
const SchemaInspectionService_1 = require("./services/SchemaInspectionService");
const StepPlanner_1 = require("./services/StepPlanner");
/**
 * Minimal diff generator (SQLite):
 * - Create table if missing
 * - Add missing non-nullable columns with default (when possible)
 *
 * Note: For complex ALTERs SQLite often requires table rebuild; here we handle simple adds.
 */
class DiffMigrationGenerator {
    constructor(provider) {
        this.provider = provider;
    }
    async generate() {
        const expected = new SchemaSnapshot_1.SchemaSnapshotBuilder().buildExpectedFromMetadata();
        const label = this.provider.providerLabel;
        const inspection = new SchemaInspectionService_1.SchemaInspectionService();
        const actual = await inspection.buildActualSnapshot(this.provider, expected);
        const planner = new StepPlanner_1.StepPlanner();
        const upSql = planner.plan(expected, actual, label);
        return upSql.map((sql) => ({ sql }));
    }
}
exports.DiffMigrationGenerator = DiffMigrationGenerator;
//# sourceMappingURL=DiffMigrationGenerator.js.map