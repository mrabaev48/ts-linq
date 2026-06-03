import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import type { EntityCtor } from '@ts-linq/types';

import { chunkGroup, groupChanges } from '../src/save-changes/batch-grouper';
import type { NormalizedChange } from '../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

class User {}
class Post {}

function makeMetadata(entityClass: Function, cols = 3, pks = ['id']) {
  const columns = [
    {
      propertyName: 'id',
      columnName: 'id',
      type: 'number' as const,
      isGenerated: true,
      isComputed: false
    },
    ...Array.from({ length: cols - 1 }, (_, i) => ({
      propertyName: `col${i + 1}`,
      columnName: `col${i + 1}`,
      type: 'string' as const,
      isGenerated: false,
      isComputed: false
    }))
  ];
  return {
    tableName: entityClass.name.toLowerCase() + 's',
    columns,
    primaryKeys: pks,
    target: entityClass as EntityCtor,
    relationships: [],
    indexes: []
  };
}

function makeRegistry(classes: Function[]) {
  return {
    getEntity: (ec: Function) => {
      const found = classes.find((c) => c === ec);
      return found ? makeMetadata(found) : null;
    }
  } as any;
}

function makeChange(
  entityClass: Function,
  state: string,
  entity: Record<string, unknown> = {}
): NormalizedChange {
  return { entity, entityClass, state };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('groupChanges()', () => {
  const registry = makeRegistry([User, Post]);

  it('groups consecutive changes with the same (entityClass, operation)', () => {
    const changes: NormalizedChange[] = [
      makeChange(User, 'added', { col1: 'a' }),
      makeChange(User, 'added', { col1: 'b' }),
      makeChange(Post, 'added', { col1: 'c' })
    ];

    const groups = groupChanges(changes, registry);
    expect(groups).toHaveLength(2);
    expect(groups[0].entityClass).toBe(User);
    expect(groups[0].operation).toBe('insert');
    expect(groups[0].entities).toHaveLength(2);
    expect(groups[1].entityClass).toBe(Post);
    expect(groups[1].operation).toBe('insert');
  });

  it('splits into separate groups when operation changes', () => {
    const changes: NormalizedChange[] = [
      makeChange(User, 'added'),
      makeChange(User, 'modified'),
      makeChange(User, 'added')
    ];

    const groups = groupChanges(changes, registry);
    expect(groups).toHaveLength(3);
    expect(groups[0].operation).toBe('insert');
    expect(groups[1].operation).toBe('update');
    expect(groups[2].operation).toBe('insert');
  });

  it('maps state names to operations correctly', () => {
    const changes: NormalizedChange[] = [
      makeChange(User, 'added'),
      makeChange(User, 'modified'),
      makeChange(User, 'deleted')
    ];
    const groups = groupChanges(changes, registry);
    expect(groups.map((g) => g.operation)).toEqual(['insert', 'update', 'delete']);
  });

  it('skips unknown state values', () => {
    const changes: NormalizedChange[] = [
      makeChange(User, 'added'),
      makeChange(User, 'unchanged'),
      makeChange(User, 'added')
    ];
    const groups = groupChanges(changes, registry);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.operation !== ('unchanged' as any))).toBe(true);
  });

  it('throws when metadata is missing', () => {
    class Unknown {}
    expect(() => groupChanges([makeChange(Unknown, 'added')], registry)).toThrow(/no metadata/i);
  });

  it('returns empty array for empty input', () => {
    expect(groupChanges([], registry)).toEqual([]);
  });
});

describe('chunkGroup()', () => {
  const registry = makeRegistry([User]);

  function makeGroup(count: number, operation: 'insert' | 'update' | 'delete' = 'insert') {
    return {
      entityClass: User,
      metadata: makeMetadata(User, 3, ['id']),
      operation,
      entities: Array.from({ length: count }, (_, i) => ({
        col1: `v${i}`,
        col2: `w${i}`
      }))
    };
  }

  it('returns a single chunk when count <= maxBatchSize', () => {
    const group = makeGroup(5);
    const chunks = chunkGroup(group, 10, 65535);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].entities).toHaveLength(5);
  });

  it('splits into multiple chunks when count > maxBatchSize', () => {
    const group = makeGroup(10);
    const chunks = chunkGroup(group, 3, 65535);
    expect(chunks).toHaveLength(4);
    expect(chunks[0].entities).toHaveLength(3);
    expect(chunks[3].entities).toHaveLength(1);
  });

  it('respects parameterLimit boundary — insert', () => {
    // 2 non-PK columns → paramsPerRow = 2; paramLimit = 6 → chunkSize = min(100, 3) = 3
    const group = {
      entityClass: User,
      metadata: makeMetadata(User, 3, ['id']),
      operation: 'insert' as const,
      entities: Array.from({ length: 9 }, () => ({ col1: 'a', col2: 'b' }))
    };
    const chunks = chunkGroup(group, 100, 6);
    // calcChunkSize: paramsPerRow=2, max=100, limit=6 → floor(6/2)=3; chunk=3 → 3 chunks
    expect(chunks).toHaveLength(3);
    for (const c of chunks) expect(c.entities).toHaveLength(3);
  });

  it('preserves metadata and entityClass in each chunk', () => {
    const group = makeGroup(5, 'delete');
    const chunks = chunkGroup(group, 2, 65535);
    for (const c of chunks) {
      expect(c.entityClass).toBe(User);
      expect(c.operation).toBe('delete');
    }
  });

  it('returns at least 1 entity per chunk even for very wide rows', () => {
    const group = {
      entityClass: User,
      metadata: makeMetadata(User, 100, ['id']),
      operation: 'insert' as const,
      entities: [{ col1: 'a' }]
    };
    // paramLimit = 5, paramsPerRow = 99 → floor(5/99)=0, max(1,0)=1
    const chunks = chunkGroup(group, 50, 5);
    expect(chunks).toHaveLength(1);
  });
});
