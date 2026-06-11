import type { EntityMetadata } from '@ts-linq/types';

import { FragmentJoinPlanner } from '../src/visitors/FragmentJoinPlanner';

function makeMetadata(partial: Partial<EntityMetadata> & { tableName: string }): EntityMetadata {
  return {
    columns: [],
    relationships: [],
    indexes: [],
    primaryKeys: [],
    ...partial
  };
}

describe('FragmentJoinPlanner (P1-25)', () => {
  const planner = new FragmentJoinPlanner();

  it('returns empty array for entity with no fragments', () => {
    const meta = makeMetadata({ tableName: 'Orders' });
    expect(planner.plan(meta)).toEqual([]);
  });

  it('returns empty array for entity with empty fragments array', () => {
    const meta = makeMetadata({ tableName: 'Orders', tableFragments: [] });
    expect(planner.plan(meta)).toEqual([]);
  });

  it('returns empty array when entity has no primary keys', () => {
    const meta = makeMetadata({
      tableName: 'Orders',
      primaryKeys: [],
      tableFragments: [{ tableName: 'OrdersDetails', properties: ['notes'] }]
    });
    expect(planner.plan(meta)).toEqual([]);
  });

  it('produces one INNER JOIN per fragment', () => {
    const meta = makeMetadata({
      tableName: 'Orders',
      primaryKeys: ['id'],
      columns: [{ propertyName: 'id', columnName: 'id', type: 'int' }],
      tableFragments: [
        { tableName: 'OrdersDetails', properties: ['notes'] },
        { tableName: 'OrdersExtra', properties: ['internalRef'] }
      ]
    });

    const joins = planner.plan(meta);
    expect(joins).toHaveLength(2);
    expect(joins[0]).toEqual({
      type: 'INNER',
      table: 'OrdersDetails',
      onColumns: [
        { left: { table: 'OrdersDetails', column: 'id' }, right: { table: 'Orders', column: 'id' } }
      ]
    });
    expect(joins[1]).toEqual({
      type: 'INNER',
      table: 'OrdersExtra',
      onColumns: [
        { left: { table: 'OrdersExtra', column: 'id' }, right: { table: 'Orders', column: 'id' } }
      ]
    });
  });

  it('resolves column name from columns array by propertyName', () => {
    const meta = makeMetadata({
      tableName: 'Orders',
      primaryKeys: ['orderId'],
      columns: [{ propertyName: 'orderId', columnName: 'order_id', type: 'int' }],
      tableFragments: [{ tableName: 'OrdersDetails', properties: ['notes'] }]
    });

    const [join] = planner.plan(meta);
    expect(join.onColumns).toEqual([
      {
        left: { table: 'OrdersDetails', column: 'order_id' },
        right: { table: 'Orders', column: 'order_id' }
      }
    ]);
  });

  it('falls back to propertyName when column is not found', () => {
    const meta = makeMetadata({
      tableName: 'Orders',
      primaryKeys: ['id'],
      columns: [],
      tableFragments: [{ tableName: 'OrdersDetails', properties: ['notes'] }]
    });

    const [join] = planner.plan(meta);
    expect(join.onColumns).toEqual([
      { left: { table: 'OrdersDetails', column: 'id' }, right: { table: 'Orders', column: 'id' } }
    ]);
  });

  it('handles composite primary keys', () => {
    const meta = makeMetadata({
      tableName: 'OrderLines',
      primaryKeys: ['orderId', 'lineId'],
      columns: [
        { propertyName: 'orderId', columnName: 'order_id', type: 'int' },
        { propertyName: 'lineId', columnName: 'line_id', type: 'int' }
      ],
      tableFragments: [{ tableName: 'OrderLinesDetail', properties: ['notes'] }]
    });

    const [join] = planner.plan(meta);
    expect(join.onColumns).toEqual([
      {
        left: { table: 'OrderLinesDetail', column: 'order_id' },
        right: { table: 'OrderLines', column: 'order_id' }
      },
      {
        left: { table: 'OrderLinesDetail', column: 'line_id' },
        right: { table: 'OrderLines', column: 'line_id' }
      }
    ]);
  });
});
