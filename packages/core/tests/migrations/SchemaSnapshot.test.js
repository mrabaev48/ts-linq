'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const MetadataStorage_1 = require('../../src/metadata/MetadataStorage');
const SchemaSnapshot_1 = require('../../src/migrations/SchemaSnapshot');
const DiffTypes_1 = require('../../src/migrations/DiffTypes');
const DialectMigrationSql_1 = require('../../src/migrations/DialectMigrationSql');
class User {}
describe('SchemaSnapshot helpers', () => {
  beforeEach(() => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
  });
  test('buildExpectedSchemaFromMetadata includes computed and defaultExpression', () => {
    MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
    const cols = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
      {
        propertyName: 'nameLength',
        columnName: 'name_len',
        type: 'INTEGER',
        nullable: true,
        isComputed: true,
        computedExpression: 'length(name)',
        computedStorage: 'STORED'
      },
      {
        propertyName: 'createdAt',
        columnName: 'created_at',
        type: 'DATETIME',
        nullable: false,
        defaultExpression: 'CURRENT_TIMESTAMP',
        defaultExpressionDialect: { postgresql: 'CURRENT_TIMESTAMP' }
      }
    ];
    cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(User, c));
    MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
    const snapshot = new SchemaSnapshot_1.SchemaSnapshotBuilder().buildExpectedFromMetadata();
    expect(snapshot.tables.length).toBe(1);
    const table = snapshot.tables[0];
    const cc = table.columns.find((c) => c.name === 'name_len');
    expect(cc?.isComputed).toBe(true);
    expect(cc?.computedExpression).toBe('length(name)');
    const createdAt = table.columns.find((c) => c.name === 'created_at');
    expect(createdAt?.defaultExpression).toBe('CURRENT_TIMESTAMP');
    const json = new SchemaSnapshot_1.SchemaSnapshotSerializer().serialize(snapshot);
    const back = new SchemaSnapshot_1.SchemaSnapshotSerializer().deserialize(json);
    expect(back.tables[0].columns.find((c) => c.name === 'name_len')?.computedExpression).toBe(
      'length(name)'
    );
  });
  test('generateMigrationFromDiff renders computed/defaultExpression per dialect', () => {
    MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
    const cols = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
      {
        propertyName: 'nameLength',
        columnName: 'name_len',
        type: 'INTEGER',
        nullable: true,
        isComputed: true,
        computedExpression: 'length(name)',
        computedStorage: 'STORED'
      },
      {
        propertyName: 'createdAt',
        columnName: 'created_at',
        type: 'DATETIME',
        nullable: false,
        defaultExpression: 'CURRENT_TIMESTAMP',
        defaultExpressionDialect: { postgresql: 'CURRENT_TIMESTAMP' }
      }
    ];
    cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(User, c));
    MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
    const expected = new SchemaSnapshot_1.SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const diff = (0, DiffTypes_1.compareSchemas)(expected, { tables: [] });
    const pg = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql').up.join(
      '\n'
    );
    expect(pg).toContain('GENERATED ALWAYS AS (length(name)) STORED');
    expect(pg).toContain('DEFAULT CURRENT_TIMESTAMP');
    const mysql = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql').up.join('\n');
    expect(mysql).toContain('GENERATED ALWAYS AS (length(name))');
    const sqlite = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'sqlite').up.join(
      '\n'
    );
    expect(sqlite).toContain('GENERATED ALWAYS AS (length(name))');
    const mssql = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mssql').up.join('\n');
    expect(mssql).toContain('AS (length(name))');
  });
});
//# sourceMappingURL=SchemaSnapshot.test.js.map
