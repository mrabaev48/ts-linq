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

describe('SchemaSnapshotBuilder — keyless / view entities (P1-26)', () => {
  it('keyless entity with viewName is excluded from tables', () => {
    const view = makeMetadata({
      tableName: 'SalesSummary',
      isKeyless: true,
      viewName: 'v_sales_summary'
    });
    const snapshot = buildSnapshotFromEntities([view]);
    expect(snapshot.tables).toHaveLength(0);
  });

  it('keyless entity with viewName appears in views array', () => {
    const view = makeMetadata({
      tableName: 'SalesSummary',
      isKeyless: true,
      viewName: 'v_sales_summary'
    });
    const snapshot = buildSnapshotFromEntities([view]);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.views![0].name).toBe('v_sales_summary');
  });

  it('view with hasViewSql includes sql in ViewSnapshot', () => {
    const view = makeMetadata({
      tableName: 'SalesSummary',
      isKeyless: true,
      viewName: 'v_sales_summary',
      viewSql: 'SELECT region, SUM(total) AS totalSales FROM orders GROUP BY region'
    });
    const snapshot = buildSnapshotFromEntities([view]);
    expect(snapshot.views![0].sql).toBe(
      'SELECT region, SUM(total) AS totalSales FROM orders GROUP BY region'
    );
  });

  it('view without hasViewSql has no sql field in ViewSnapshot', () => {
    const view = makeMetadata({
      tableName: 'SalesSummary',
      isKeyless: true,
      viewName: 'v_sales_summary'
    });
    const snapshot = buildSnapshotFromEntities([view]);
    expect(snapshot.views![0].sql).toBeUndefined();
  });

  it('regular entities are still emitted as tables alongside views', () => {
    const order = makeMetadata({
      tableName: 'orders',
      primaryKeys: ['id'],
      columns: [{ propertyName: 'id', columnName: 'id', type: 'int' }]
    });
    const view = makeMetadata({
      tableName: 'SalesSummary',
      isKeyless: true,
      viewName: 'v_sales_summary'
    });
    const snapshot = buildSnapshotFromEntities([order, view]);
    expect(snapshot.tables).toHaveLength(1);
    expect(snapshot.tables[0].name).toBe('orders');
    expect(snapshot.views).toHaveLength(1);
  });

  it('snapshot has no views property when no keyless entities present', () => {
    const order = makeMetadata({
      tableName: 'orders',
      primaryKeys: ['id'],
      columns: [{ propertyName: 'id', columnName: 'id', type: 'int' }]
    });
    const snapshot = buildSnapshotFromEntities([order]);
    expect(snapshot.views).toBeUndefined();
  });
});
