import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata } from '../types';
import {
  SchemaSnapshotBuilder,
  SchemaSnapshotSerializer
} from '../../src/migrations/SchemaSnapshot';
import { compareSchemas } from '../../src/migrations/DiffTypes';
import { generateMigrationFromDiff } from '../../src/migrations/DialectMigrationSql';

class User {
  id!: number;
  name!: string;
  nameLength!: number;
  createdAt!: Date;
}

describe('SchemaSnapshot helpers', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  test('buildExpectedSchemaFromMetadata includes computed and defaultExpression', () => {
    MetadataStorage.addEntity(User, 'Users');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
      {
        propertyName: 'nameLength',
        columnName: 'name_len',
        type: 'INTEGER',
        nullable: true,
        isComputed: true,
        computedExpression: 'length(name)',
        computedStorage: 'STORED' as any
      } as unknown as ColumnMetadata,
      {
        propertyName: 'createdAt',
        columnName: 'created_at',
        type: 'DATETIME',
        nullable: false,
        defaultExpression: 'CURRENT_TIMESTAMP',
        defaultExpressionDialect: { postgresql: 'CURRENT_TIMESTAMP' } as any
      } as unknown as ColumnMetadata
    ];
    cols.forEach((c) => MetadataStorage.addColumn(User, c));
    MetadataStorage.addPrimaryKey(User, 'id');

    const snapshot = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    expect(snapshot.tables.length).toBe(1);
    const table = snapshot.tables[0];
    const cc = table.columns.find((c) => c.name === 'name_len');
    expect(cc?.isComputed).toBe(true);
    expect(cc?.computedExpression).toBe('length(name)');
    const createdAt = table.columns.find((c) => c.name === 'created_at');
    expect(createdAt?.defaultExpression).toBe('CURRENT_TIMESTAMP');

    const json = new SchemaSnapshotSerializer().serialize(snapshot);
    const back = new SchemaSnapshotSerializer().deserialize(json);
    expect(back.tables[0].columns.find((c) => c.name === 'name_len')?.computedExpression).toBe(
      'length(name)'
    );
  });

  test('generateMigrationFromDiff renders computed/defaultExpression per dialect', () => {
    MetadataStorage.addEntity(User, 'Users');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
      {
        propertyName: 'nameLength',
        columnName: 'name_len',
        type: 'INTEGER',
        nullable: true,
        isComputed: true,
        computedExpression: 'length(name)',
        computedStorage: 'STORED' as any
      } as unknown as ColumnMetadata,
      {
        propertyName: 'createdAt',
        columnName: 'created_at',
        type: 'DATETIME',
        nullable: false,
        defaultExpression: 'CURRENT_TIMESTAMP',
        defaultExpressionDialect: { postgresql: 'CURRENT_TIMESTAMP' } as any
      } as unknown as ColumnMetadata
    ];
    cols.forEach((c) => MetadataStorage.addColumn(User, c));
    MetadataStorage.addPrimaryKey(User, 'id');

    const expected = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const diff = compareSchemas(expected, { tables: [] });

    const pg = generateMigrationFromDiff(diff, 'postgresql').up.join('\n');
    expect(pg).toContain('GENERATED ALWAYS AS (length(name)) STORED');
    expect(pg).toContain('DEFAULT CURRENT_TIMESTAMP');

    const mysql = generateMigrationFromDiff(diff, 'mysql').up.join('\n');
    expect(mysql).toContain('GENERATED ALWAYS AS (length(name))');

    const sqlite = generateMigrationFromDiff(diff, 'sqlite').up.join('\n');
    expect(sqlite).toContain('GENERATED ALWAYS AS (length(name))');

    const mssql = generateMigrationFromDiff(diff, 'mssql').up.join('\n');
    expect(mssql).toContain('AS (length(name))');
  });
});
