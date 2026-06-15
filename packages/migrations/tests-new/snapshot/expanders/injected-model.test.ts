import { describe, expect, it } from '@jest/globals';
import type { SequenceMetadata } from '@ts-linq/types';

import { SchemaSnapshotBuilder } from '../../../src/SchemaSnapshot';
import { ModelSnapshotBuilder } from '../../../src/snapshot/model-snapshot';
import { col, entity } from './support';

describe('Snapshot builders — injected model (DIP)', () => {
  it('ModelSnapshotBuilder.buildFrom snapshots an injected entity list with canonical sorting', () => {
    const users = entity({
      tableName: 'users',
      primaryKeys: ['id'],
      columns: [
        col({ columnName: 'name', propertyName: 'name', type: 'TEXT' }),
        col({ columnName: 'id', propertyName: 'id', type: 'INTEGER', nullable: false })
      ]
    });
    const posts = entity({
      tableName: 'posts',
      primaryKeys: ['id'],
      columns: [col({ columnName: 'id', propertyName: 'id', type: 'INTEGER', nullable: false })]
    });

    const snapshot = new ModelSnapshotBuilder().buildFrom([users, posts]);

    // Tables sorted by name (posts < users); columns sorted by name (id < name).
    expect(snapshot.tables.map((t) => t.name)).toEqual(['posts', 'users']);
    const usersTable = snapshot.tables.find((t) => t.name === 'users')!;
    expect(usersTable.columns.map((c) => c.name)).toEqual(['id', 'name']);
  });

  it('SchemaSnapshotBuilder.buildFrom snapshots injected entities + sequences', () => {
    const orders = entity({
      tableName: 'orders',
      primaryKeys: ['id'],
      columns: [col({ columnName: 'id', propertyName: 'id', type: 'INTEGER', nullable: false })]
    });
    const sequences = [{ name: 'order_seq', startsAt: 1 }] as unknown as SequenceMetadata[];

    const snapshot = new SchemaSnapshotBuilder().buildFrom([orders], sequences);

    expect(snapshot.tables.map((t) => t.name)).toEqual(['orders']);
    expect(snapshot.sequences).toEqual([{ name: 'order_seq', startsAt: 1 }]);
  });
});
