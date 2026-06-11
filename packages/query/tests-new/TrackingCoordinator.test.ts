/**
 * Unit tests for {@link TrackingCoordinator} — the stateless tracking / identity-resolution
 * collaborator extracted from `Queryable` (refactor query/task-1).
 */
import { QueryTrackingBehavior } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityAttacher } from '@ts-linq/types';

import { TrackingCoordinator } from '../src/TrackingCoordinator';

class TrackUser {
  id!: number;
  name!: string;
}

/** Entity registered without a primary key — exercises the dedup no-PK passthrough. */
class NoPkRow {
  value!: string;
}

beforeAll(() => {
  MetadataStorage.addEntity(TrackUser, 'track_users');
  MetadataStorage.addColumn(TrackUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
  MetadataStorage.addColumn(TrackUser, { propertyName: 'name', columnName: 'name', type: 'TEXT' });
  MetadataStorage.addPrimaryKey(TrackUser, 'id');

  MetadataStorage.addEntity(NoPkRow, 'no_pk_rows');
  MetadataStorage.addColumn(NoPkRow, { propertyName: 'value', columnName: 'value', type: 'TEXT' });
});

function makeAttacher(): { attacher: EntityAttacher; attached: object[] } {
  const attached: object[] = [];
  const attacher = {
    attach: (entity: object) => {
      attached.push(entity);
    }
  } as unknown as EntityAttacher;
  return { attacher, attached };
}

describe('TrackingCoordinator', () => {
  const coordinator = new TrackingCoordinator();

  it('TrackAll with an attacher attaches every entity and returns them unchanged', () => {
    const { attacher, attached } = makeAttacher();
    const entities = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' }
    ];

    const result = coordinator.apply(entities, TrackUser, QueryTrackingBehavior.TrackAll, attacher);

    expect(result).toBe(entities);
    expect(attached).toHaveLength(2);
    expect(attached).toEqual(entities);
  });

  it('TrackAll without an attacher returns the list untouched (no attach, no dedup)', () => {
    const entities = [
      { id: 1, name: 'a' },
      { id: 1, name: 'a-dup' }
    ];

    const result = coordinator.apply(
      entities,
      TrackUser,
      QueryTrackingBehavior.TrackAll,
      undefined
    );

    expect(result).toBe(entities);
    expect(result).toHaveLength(2);
  });

  it('NoTracking returns the list untouched', () => {
    const { attacher, attached } = makeAttacher();
    const entities = [{ id: 1, name: 'a' }];

    const result = coordinator.apply(
      entities,
      TrackUser,
      QueryTrackingBehavior.NoTracking,
      attacher
    );

    expect(result).toBe(entities);
    expect(attached).toHaveLength(0);
  });

  it('NoTrackingWithIdentityResolution deduplicates by PK, keeping the first-seen instance', () => {
    const first = { id: 1, name: 'first' };
    const dup = { id: 1, name: 'dup' };
    const other = { id: 2, name: 'other' };
    const entities = [first, dup, other];

    const result = coordinator.apply(
      entities,
      TrackUser,
      QueryTrackingBehavior.NoTrackingWithIdentityResolution,
      undefined
    );

    // Duplicate PK row is replaced by the first-seen instance (reference equality).
    expect(result).toEqual([first, first, other]);
    expect(result[1]).toBe(first);
  });

  it('NoTrackingWithIdentityResolution leaves rows without a primary key untouched', () => {
    const entities = [{ value: 'x' }, { value: 'x' }];

    const result = coordinator.apply(
      entities,
      NoPkRow,
      QueryTrackingBehavior.NoTrackingWithIdentityResolution,
      undefined
    );

    expect(result).toBe(entities);
    expect(result).toHaveLength(2);
  });
});
