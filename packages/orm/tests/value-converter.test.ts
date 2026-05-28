import { createMetadataRegistry, ValueComparer, ValueConverter } from '@ts-linq/metadata';
import type { ColumnMetadata } from '@ts-linq/types';

import { ChangeTracker } from '../src/ChangeTracker';
import { ModelBuilder } from '../src/ModelBuilder';

// ─── Test entities ────────────────────────────────────────────────────────────

class ActiveEntity {
  id!: number;
  active!: boolean;
}

class RoleEntity {
  id!: number;
  role!: string;
}

// ─── PropertyBuilder.hasConversion ───────────────────────────────────────────

describe('PropertyBuilder.hasConversion', () => {
  it('sets converter on column via function overload', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    registry.addEntity(ActiveEntity, 'active_entities');
    registry.addColumn(ActiveEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addColumn(ActiveEntity, {
      propertyName: 'active',
      columnName: 'active',
      type: 'INTEGER'
    });
    registry.addPrimaryKey(ActiveEntity, 'id');

    mb.entity(ActiveEntity, (b) => {
      b.property((e) => e.active).hasConversion<number>(
        (v) => (v ? 1 : 0),
        (v) => v !== 0
      );
    });

    mb._finalize();

    const meta = registry.getEntity(ActiveEntity);
    const column = meta?.columns.find((c) => c.propertyName === 'active');
    expect(column?.converter).toBeDefined();
    expect(column?.converter?.toProvider(true)).toBe(1);
    expect(column?.converter?.fromProvider(0)).toBe(false);
  });

  it('sets converter on column via ValueConverter instance overload', () => {
    const conv = new ValueConverter<string, string>(
      (v) => v.toUpperCase(),
      (v) => v.toLowerCase()
    );

    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    registry.addEntity(RoleEntity, 'role_entities');
    registry.addColumn(RoleEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addColumn(RoleEntity, { propertyName: 'role', columnName: 'role', type: 'TEXT' });
    registry.addPrimaryKey(RoleEntity, 'id');

    mb.entity(RoleEntity, (b) => {
      b.property((e) => e.role).hasConversion(conv);
    });

    mb._finalize();

    const meta = registry.getEntity(RoleEntity);
    const col = meta?.columns.find((c) => c.propertyName === 'role');
    expect(col?.converter?.toProvider('admin')).toBe('ADMIN');
    expect(col?.converter?.fromProvider('ADMIN')).toBe('admin');
  });
});

// ─── ChangeTracker with ValueComparer ────────────────────────────────────────

describe('ChangeTracker with ValueComparer', () => {
  it('detects array mutation in place using comparer.equals', () => {
    const arrayCmp = new ValueComparer<string[]>(
      (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
      (v) => v.reduce((h, s) => h ^ s.charCodeAt(0), 0),
      (v) => [...v]
    );

    const registry = createMetadataRegistry();

    class TagEntity {
      id = 1;
      tags: string[] = [];
    }

    registry.addEntity(TagEntity, 'tag_entities');
    registry.addColumn(TagEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    const tagsCol: ColumnMetadata = {
      propertyName: 'tags',
      columnName: 'tags',
      type: 'TEXT',
      comparer: arrayCmp
    };
    registry.addColumn(TagEntity, tagsCol);
    registry.addPrimaryKey(TagEntity, 'id');

    const tracker = new ChangeTracker(registry);

    const entity = new TagEntity();
    entity.tags = ['a', 'b'];
    tracker.attach(entity, TagEntity);

    // Mutate in place — comparer.equals compares contents → detects mutation
    entity.tags.push('c');

    tracker.detectChanges();

    const changes = tracker.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].entity).toBe(entity);
  });

  it('does NOT mark dirty when comparer.equals returns true', () => {
    const constEqualCmp = new ValueComparer<number[]>(
      () => true, // always equal
      () => 0,
      (v) => [...v]
    );

    const registry = createMetadataRegistry();

    class ScoreEntity {
      id = 1;
      scores: number[] = [];
    }

    registry.addEntity(ScoreEntity, 'score_entities');
    registry.addColumn(ScoreEntity, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addColumn(ScoreEntity, {
      propertyName: 'scores',
      columnName: 'scores',
      type: 'TEXT',
      comparer: constEqualCmp
    });
    registry.addPrimaryKey(ScoreEntity, 'id');

    const tracker = new ChangeTracker(registry);
    const e = new ScoreEntity();
    e.scores = [1, 2, 3];
    tracker.attach(e, ScoreEntity);

    // Change the value — but comparer says equal
    e.scores = [99, 100];
    tracker.detectChanges();

    expect(tracker.getChanges()).toHaveLength(0);
  });
});
