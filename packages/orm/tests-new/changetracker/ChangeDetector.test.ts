import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { createMetadataRegistry } from '@ts-linq/metadata';
import type { TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

import { ChangeDetector } from '../../src/changetracker/ChangeDetector';
import { defaultEqualityComparer } from '../../src/changetracker/EqualityComparer';
import { ShadowValueStore } from '../../src/changetracker/ShadowValueStore';

class Widget {
  id!: number;
  name!: string;
}

function buildRegistry() {
  const registry = createMetadataRegistry();
  registry.addEntity(Widget, 'widgets');
  registry.setFluentPrimaryKeys(Widget, ['id']);
  registry.mergeFluentColumn(Widget, {
    propertyName: 'id',
    columnName: 'id',
    type: 'int',
    nullable: false
  });
  registry.mergeFluentColumn(Widget, {
    propertyName: 'name',
    columnName: 'name',
    type: 'string',
    nullable: false
  });
  return registry;
}

function unchanged(entity: Widget, original: Widget): TrackedEntity {
  return { entity, entityClass: Widget, state: EntityState.Unchanged, originalValues: original };
}

describe('ChangeDetector', () => {
  const make = () =>
    new ChangeDetector(buildRegistry(), defaultEqualityComparer, new ShadowValueStore());

  it('marks an Unchanged entity Modified when a column changes', () => {
    const detector = make();
    const entity: Widget = { id: 1, name: 'after' };
    const t = unchanged(entity, { id: 1, name: 'before' });

    detector.detectChanges([t]);
    expect(t.state).toBe(EntityState.Modified);
  });

  it('leaves an unchanged entity alone', () => {
    const detector = make();
    const entity: Widget = { id: 1, name: 'same' };
    const t = unchanged(entity, { id: 1, name: 'same' });

    detector.detectChanges([t]);
    expect(t.state).toBe(EntityState.Unchanged);
  });

  it('hasChanged uses deep equality when no column comparer is configured', () => {
    const detector = make();
    expect(detector.hasChanged({ id: 1, name: 'a' }, { id: 1, name: 'a' }, Widget)).toBe(false);
    expect(detector.hasChanged({ id: 1, name: 'a' }, { id: 1, name: 'b' }, Widget)).toBe(true);
  });

  it('hasShadowChanged is true once a shadow value is set', () => {
    const registry = buildRegistry();
    registry.addShadowProperty(Widget, {
      propertyName: 'updatedAt',
      columnName: 'updatedAt',
      type: 'string'
    });
    const shadow = new ShadowValueStore();
    const detector = new ChangeDetector(registry, defaultEqualityComparer, shadow);
    const entity: Widget = { id: 1, name: 'x' };

    expect(detector.hasShadowChanged(entity, Widget)).toBe(false);
    shadow.set(entity, 'updatedAt', new Date());
    expect(detector.hasShadowChanged(entity, Widget)).toBe(true);
  });
});
