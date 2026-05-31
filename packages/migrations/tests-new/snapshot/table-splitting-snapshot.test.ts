import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata } from '@ts-linq/types';

import { SchemaSnapshotBuilder } from '../../src/SchemaSnapshot';

function makeMetadata(partial: Partial<EntityMetadata> & { tableName: string }): EntityMetadata {
  return {
    columns: [],
    relationships: [],
    indexes: [],
    primaryKeys: [],
    ...partial
  };
}

/**
 * Calls `buildExpectedFromMetadata` with the given entities injected via a
 * temporary `getEntities` override (no global MetadataStorage mutation).
 */
function buildSnapshotFromEntities(
  entities: EntityMetadata[]
): ReturnType<SchemaSnapshotBuilder['buildExpectedFromMetadata']> {
  const original = MetadataStorage.getEntities.bind(MetadataStorage);
  MetadataStorage.getEntities = () => entities;
  try {
    return new SchemaSnapshotBuilder().buildExpectedFromMetadata();
  } finally {
    MetadataStorage.getEntities = original;
  }
}

describe('SchemaSnapshotBuilder — table splitting (P1-25)', () => {
  it('two entities with the same tableName produce a single merged TableSnapshot', () => {
    const customer = makeMetadata({
      tableName: 'Customers',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'int' },
        { propertyName: 'name', columnName: 'name', type: 'varchar' }
      ]
    });
    const detail = makeMetadata({
      tableName: 'Customers',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'int' },
        { propertyName: 'bio', columnName: 'bio', type: 'text' }
      ]
    });

    const snapshot = buildSnapshotFromEntities([customer, detail]);

    expect(snapshot.tables).toHaveLength(1);
    expect(snapshot.tables[0].name).toBe('Customers');
    const colNames = snapshot.tables[0].columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('bio');
  });

  it('does not duplicate shared PK column when merging two entities', () => {
    const a = makeMetadata({
      tableName: 'Shared',
      primaryKeys: ['id'],
      columns: [{ propertyName: 'id', columnName: 'id', type: 'int' }]
    });
    const b = makeMetadata({
      tableName: 'Shared',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'int' },
        { propertyName: 'extra', columnName: 'extra', type: 'varchar' }
      ]
    });

    const snapshot = buildSnapshotFromEntities([a, b]);
    const idCols = snapshot.tables[0].columns.filter((c) => c.name === 'id');
    expect(idCols).toHaveLength(1);
  });
});

describe('SchemaSnapshotBuilder — entity splitting (P1-25)', () => {
  it('entity with tableFragments produces multiple TableSnapshots', () => {
    const order = makeMetadata({
      tableName: 'Orders',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'int' },
        { propertyName: 'total', columnName: 'total', type: 'decimal' },
        { propertyName: 'notes', columnName: 'notes', type: 'text' },
        { propertyName: 'internalRef', columnName: 'internal_ref', type: 'varchar' }
      ],
      tableFragments: [{ tableName: 'OrdersDetails', properties: ['notes', 'internalRef'] }]
    });

    const snapshot = buildSnapshotFromEntities([order]);

    // Primary table must exclude fragment-assigned properties.
    const primaryTable = snapshot.tables.find((t) => t.name === 'Orders');
    expect(primaryTable).toBeDefined();
    const primaryColNames = primaryTable!.columns.map((c) => c.name);
    expect(primaryColNames).toContain('id');
    expect(primaryColNames).toContain('total');
    expect(primaryColNames).not.toContain('notes');
    expect(primaryColNames).not.toContain('internal_ref');

    // Fragment table must include PK + its own properties.
    const fragmentTable = snapshot.tables.find((t) => t.name === 'OrdersDetails');
    expect(fragmentTable).toBeDefined();
    const fragColNames = fragmentTable!.columns.map((c) => c.name);
    expect(fragColNames).toContain('id');
    expect(fragColNames).toContain('notes');
    expect(fragColNames).toContain('internal_ref');
    expect(fragColNames).not.toContain('total');
  });

  it('entity with multiple tableFragments produces N+1 TableSnapshots', () => {
    const product = makeMetadata({
      tableName: 'Products',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'int' },
        { propertyName: 'name', columnName: 'name', type: 'varchar' },
        { propertyName: 'description', columnName: 'description', type: 'text' },
        { propertyName: 'analyticsData', columnName: 'analytics_data', type: 'json' }
      ],
      tableFragments: [
        { tableName: 'ProductsContent', properties: ['description'] },
        { tableName: 'ProductsAnalytics', properties: ['analyticsData'] }
      ]
    });

    const snapshot = buildSnapshotFromEntities([product]);
    expect(snapshot.tables).toHaveLength(3);

    const names = snapshot.tables.map((t) => t.name).sort();
    expect(names).toEqual(['Products', 'ProductsAnalytics', 'ProductsContent'].sort());
  });

  it('entity without tableFragments behaves identically to before (no regression)', () => {
    const user = makeMetadata({
      tableName: 'Users',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'int' },
        { propertyName: 'email', columnName: 'email', type: 'varchar' }
      ]
    });

    const snapshot = buildSnapshotFromEntities([user]);
    expect(snapshot.tables).toHaveLength(1);
    expect(snapshot.tables[0].name).toBe('Users');
    expect(snapshot.tables[0].columns).toHaveLength(2);
  });

  it('fragment table contains primary key with isPrimaryKey=true', () => {
    const order = makeMetadata({
      tableName: 'Orders',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'int' },
        { propertyName: 'notes', columnName: 'notes', type: 'text' }
      ],
      tableFragments: [{ tableName: 'OrdersDetails', properties: ['notes'] }]
    });

    const snapshot = buildSnapshotFromEntities([order]);
    const fragmentTable = snapshot.tables.find((t) => t.name === 'OrdersDetails')!;
    const pkCol = fragmentTable.columns.find((c) => c.name === 'id');
    expect(pkCol?.isPrimaryKey).toBe(true);
  });
});
