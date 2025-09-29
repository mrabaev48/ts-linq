"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const DiffTypes_1 = require("../src/migrations/DiffTypes");
describe('Schema diff core', () => {
    it('detects new table and added columns', () => {
        const expected = {
            tables: [
                {
                    name: 'Users',
                    columns: [
                        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
                        { name: 'name', type: 'TEXT', nullable: false }
                    ],
                    primaryKeys: ['id'],
                    indexes: [],
                    foreignKeys: []
                }
            ]
        };
        const actual = { tables: [] };
        const diff = (0, DiffTypes_1.compareSchemas)(expected, actual);
        expect(diff.tables.some((t) => (!!t.create && t.table === 'Users') || !!t.create)).toBeTruthy();
        const created = diff.tables.find((t) => t.create);
        expect(created.create.name).toBe('Users');
    });
});
//# sourceMappingURL=migrations-diff-core.test.js.map