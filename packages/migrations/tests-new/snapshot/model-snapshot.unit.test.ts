import { describe, expect, it, jest } from '@jest/globals';

import { ModelSnapshotBuilder, ModelSnapshotSerializer } from '../../src/snapshot/model-snapshot';

// Mock MetadataStorage to avoid real decorator-based metadata registration
jest.mock('@ts-linq/metadata', () => ({
  MetadataStorage: {
    getEntities: jest.fn(() => [
      {
        tableName: 'users',
        primaryKeys: ['id'],
        columns: [
          { columnName: 'id', propertyName: 'id', type: 'INTEGER', nullable: false },
          { columnName: 'name', propertyName: 'name', type: 'TEXT', nullable: true }
        ],
        indexes: [{ name: 'idx_users_name', columns: ['name'], unique: false }]
      },
      {
        tableName: 'posts',
        primaryKeys: ['post_id'],
        columns: [
          { columnName: 'post_id', propertyName: 'postId', type: 'INTEGER', nullable: false },
          {
            columnName: 'title',
            propertyName: 'title',
            type: 'TEXT',
            nullable: false,
            defaultValue: 'Untitled'
          }
        ],
        indexes: []
      }
    ])
  }
}));

describe('ModelSnapshotBuilder', () => {
  it('builds a snapshot from metadata', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    expect(snapshot.version).toBe(1);
    expect(snapshot.tables).toHaveLength(2);
  });

  it('sorts tables alphabetically', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    expect(snapshot.tables[0].name).toBe('posts');
    expect(snapshot.tables[1].name).toBe('users');
  });

  it('sorts columns alphabetically within each table', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const users = snapshot.tables.find((t) => t.name === 'users')!;
    expect(users.columns[0].name).toBe('id');
    expect(users.columns[1].name).toBe('name');
  });

  it('maps column types to uppercase', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const users = snapshot.tables.find((t) => t.name === 'users')!;
    const idCol = users.columns.find((c) => c.name === 'id')!;

    expect(idCol.type).toBe('INTEGER');
  });

  it('marks primary key columns correctly', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const users = snapshot.tables.find((t) => t.name === 'users')!;
    const idCol = users.columns.find((c) => c.name === 'id')!;
    const nameCol = users.columns.find((c) => c.name === 'name')!;

    expect(idCol.isPrimaryKey).toBe(true);
    expect(nameCol.isPrimaryKey).toBe(false);
  });

  it('preserves primary keys list', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const users = snapshot.tables.find((t) => t.name === 'users')!;
    expect(users.primaryKeys).toContain('id');
  });

  it('includes index metadata', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const users = snapshot.tables.find((t) => t.name === 'users')!;
    expect(users.indexes).toHaveLength(1);
    expect(users.indexes[0].name).toBe('idx_users_name');
  });

  it('preserves defaultValue on columns', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const posts = snapshot.tables.find((t) => t.name === 'posts')!;
    const titleCol = posts.columns.find((c) => c.name === 'title')!;
    expect(titleCol.defaultValue).toBe('Untitled');
  });
});

describe('ModelSnapshotSerializer', () => {
  const serializer = new ModelSnapshotSerializer();

  const sampleSnapshot = {
    version: 1 as const,
    tables: [
      {
        name: 'users',
        columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }],
        primaryKeys: ['id'],
        indexes: []
      }
    ]
  };

  it('serializes a snapshot to JSON', () => {
    const json = serializer.serialize(sampleSnapshot);
    expect(typeof json).toBe('string');
    expect(json).toContain('"version": 1');
    expect(json).toContain('"tables"');
  });

  it('round-trips serialize/deserialize', () => {
    const json = serializer.serialize(sampleSnapshot);
    const restored = serializer.deserialize(json);

    expect(restored.version).toBe(1);
    expect(restored.tables).toHaveLength(1);
    expect(restored.tables[0].name).toBe('users');
  });

  it('throws on invalid JSON structure', () => {
    expect(() => serializer.deserialize('{"invalid": true}')).toThrow(/Invalid ModelSnapshot/);
  });

  it('throws on malformed JSON', () => {
    expect(() => serializer.deserialize('not-json')).toThrow();
  });
});
