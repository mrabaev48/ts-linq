"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@ts-linq/core");
const sqlite_1 = require("@ts-linq/sqlite");
const postgres_1 = require("@ts-linq/postgres");
const mssql_1 = require("@ts-linq/mssql");
const mysql_1 = require("@ts-linq/mysql");
class T {
}
const options = {
    select: ['authorId'],
    groupBy: { columns: ['authorId'], having: { condition: 'COUNT(*) > ?', parameters: [1] } }
};
describe('GROUP BY / HAVING in dialects', () => {
    beforeEach(() => {
        core_1.MetadataStorage.getInstance().clear();
        core_1.MetadataStorage.addEntity(T, 't');
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'authorId',
            columnName: 'authorId',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            nullable: false
        });
        core_1.MetadataStorage.addPrimaryKey(T, 'id');
    });
    test('SQLite', () => {
        core_1.MetadataStorage.getInstance().clear();
        core_1.MetadataStorage.addEntity(T, 't');
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'authorId',
            columnName: 'authorId',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            nullable: false
        });
        core_1.MetadataStorage.addPrimaryKey(T, 'id');
        const d = new sqlite_1.SQLiteDialect();
        const { query, parameters } = d.buildSelect(T, options);
        expect(query).toContain('GROUP BY authorId');
        expect(query).toContain('HAVING COUNT(*) > ?');
        expect(parameters).toEqual([1]);
    });
    test('Postgres', () => {
        core_1.MetadataStorage.getInstance().clear();
        core_1.MetadataStorage.addEntity(T, 't');
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'authorId',
            columnName: 'authorId',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            nullable: false
        });
        core_1.MetadataStorage.addPrimaryKey(T, 'id');
        const d = new postgres_1.PostgresDialect();
        const { query, parameters } = d.buildSelect(T, options);
        expect(query).toContain('GROUP BY authorId');
        expect(query).toContain('HAVING COUNT(*) > $1');
        expect(parameters).toEqual([1]);
    });
    test('MSSQL', () => {
        core_1.MetadataStorage.getInstance().clear();
        core_1.MetadataStorage.addEntity(T, 't');
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'authorId',
            columnName: 'authorId',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            nullable: false
        });
        core_1.MetadataStorage.addPrimaryKey(T, 'id');
        const d = new mssql_1.MssqlDialect();
        const { query, parameters } = d.buildSelect(T, options);
        expect(query).toContain('GROUP BY authorId');
        // MSSQL converts placeholders to @p1.. numbering after parameter binding; with 1 param it becomes @p1
        expect(query).toContain('HAVING COUNT(*) > @p1');
        expect(parameters).toEqual([1]);
    });
    test('MySQL', () => {
        core_1.MetadataStorage.getInstance().clear();
        core_1.MetadataStorage.addEntity(T, 't');
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'authorId',
            columnName: 'authorId',
            type: 'INTEGER',
            nullable: false
        });
        core_1.MetadataStorage.addColumn(T, {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            nullable: false
        });
        core_1.MetadataStorage.addPrimaryKey(T, 'id');
        const d = new mysql_1.MysqlDialect();
        const { query, parameters } = d.buildSelect(T, options);
        expect(query).toContain('GROUP BY authorId');
        expect(query).toContain('HAVING COUNT(*) > ?');
        expect(parameters).toEqual([1]);
    });
});
//# sourceMappingURL=groupby-having-dialect.test.js.map