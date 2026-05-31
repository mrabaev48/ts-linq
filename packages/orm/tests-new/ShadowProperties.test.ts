import { createMetadataRegistry } from '@ts-linq/metadata';
import { Entity, PrimaryKey } from '@ts-linq/metadata';

import { ChangeTracker } from '../src/ChangeTracker';
import { EntityEntry } from '../src/changetracker/EntityEntry';
import { PropertyEntry } from '../src/changetracker/PropertyEntry';
import { ModelBuilder } from '../src/ModelBuilder';

// ── Test entity ──────────────────────────────────────────────────────────────

@Entity({ name: 'posts' })
class Post {
  @PrimaryKey()
  id!: number;

  title!: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRegistry() {
  const registry = createMetadataRegistry();
  const mb = new ModelBuilder(registry);
  mb.entity<Post>(Post)
    .property<Date>('createdAt')
    .hasDefaultValueSql('CURRENT_TIMESTAMP')
    .isRequired();
  mb.entity<Post>(Post).property<string>('tenantId').isRequired();
  mb._finalize();
  return registry;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Shadow Properties (P1-16)', () => {
  describe('EntityMetadata: shadowProperties registration', () => {
    it('registers shadow properties via fluent property<T>(name) overload', () => {
      const registry = makeRegistry();
      const meta = registry.getEntity(Post);
      expect(meta).toBeDefined();
      expect(meta!.shadowProperties).toBeDefined();
      expect(meta!.shadowProperties!.has('createdAt')).toBe(true);
      expect(meta!.shadowProperties!.has('tenantId')).toBe(true);
    });

    it('shadow property has correct metadata', () => {
      const registry = makeRegistry();
      const meta = registry.getEntity(Post);
      const sp = meta!.shadowProperties!.get('createdAt');
      expect(sp).toBeDefined();
      expect(sp!.propertyName).toBe('createdAt');
      expect(sp!.columnName).toBe('createdAt');
      expect(sp!.nullable).toBe(false);
      expect(sp!.defaultExpression).toBe('CURRENT_TIMESTAMP');
    });

    it('does not add shadow columns to entity.columns', () => {
      const registry = makeRegistry();
      const meta = registry.getEntity(Post);
      const shadowInColumns = meta!.columns.find((c) => c.propertyName === 'createdAt');
      expect(shadowInColumns).toBeUndefined();
    });
  });

  describe('ChangeTracker: shadow value store', () => {
    it('getShadowValue returns undefined before any value is set', () => {
      const registry = makeRegistry();
      const tracker = new ChangeTracker(registry);
      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post);
      expect(tracker.getShadowValue(post, 'createdAt')).toBeUndefined();
    });

    it('setShadowValue + getShadowValue round-trips correctly', () => {
      const registry = makeRegistry();
      const tracker = new ChangeTracker(registry);
      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post);
      const now = new Date('2024-01-15T12:00:00Z');
      tracker.setShadowValue(post, 'createdAt', now);
      expect(tracker.getShadowValue(post, 'createdAt')).toBe(now);
    });

    it('getShadowValues returns the full shadow map for an entity', () => {
      const registry = makeRegistry();
      const tracker = new ChangeTracker(registry);
      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post);
      tracker.setShadowValue(post, 'createdAt', new Date());
      tracker.setShadowValue(post, 'tenantId', 'tenant-1');
      const map = tracker.getShadowValues(post);
      expect(map).toBeDefined();
      expect(map!.size).toBe(2);
      expect(map!.has('createdAt')).toBe(true);
      expect(map!.has('tenantId')).toBe(true);
    });

    it('shadow value change marks entity as Modified during detectChanges', () => {
      const registry = makeRegistry();
      const tracker = new ChangeTracker(registry);
      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post);

      // No change yet
      tracker.detectChanges();
      expect(tracker.getEntityState(post)).toBe('unchanged');

      // Set shadow value → entity should become Modified
      tracker.setShadowValue(post, 'tenantId', 'tenant-1');
      tracker.detectChanges();
      expect(tracker.getEntityState(post)).not.toBe('unchanged');
    });
  });

  describe('EntityEntry.property()', () => {
    it('returns a PropertyEntry instance', () => {
      const registry = makeRegistry();
      const tracker = new ChangeTracker(registry);
      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post);

      const entry = new EntityEntry(post, Post, {}, tracker);
      const prop = entry.property<Date>('createdAt');
      expect(prop).toBeInstanceOf(PropertyEntry);
    });

    it('PropertyEntry.currentValue getter/setter works', () => {
      const registry = makeRegistry();
      const tracker = new ChangeTracker(registry);
      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post);

      const entry = new EntityEntry(post, Post, {}, tracker);
      const now = new Date('2024-06-01T00:00:00Z');
      entry.property<Date>('createdAt').currentValue = now;
      expect(entry.property<Date>('createdAt').currentValue).toBe(now);
    });

    it('throws if EntityEntry has no ChangeTracker', () => {
      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      const entry = new EntityEntry(post, Post, {});
      expect(() => entry.property('createdAt')).toThrow(/ChangeTracker/);
    });
  });

  describe('normalizeChange: shadow values merged into persist payload', () => {
    it('getShadowValues returns Map with merged entries', () => {
      const registry = makeRegistry();
      const tracker = new ChangeTracker(registry);
      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.add(post, Post);
      tracker.setShadowValue(post, 'createdAt', new Date('2024-01-01'));
      tracker.setShadowValue(post, 'tenantId', 'acme');

      const shadowMap = tracker.getShadowValues(post);
      expect(shadowMap).toBeDefined();
      expect(shadowMap!.get('tenantId')).toBe('acme');
    });
  });

  describe('EntityTypeBuilder: overload disambiguation', () => {
    it('selector overload still works for regular properties', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity<Post>(Post)
        .property((p) => p.title)
        .hasColumnName('post_title');
      mb._finalize();
      const meta = registry.getEntity(Post);
      const titleCol = meta!.columns.find((c) => c.propertyName === 'title');
      expect(titleCol?.columnName).toBe('post_title');
    });

    it('string overload registers shadow property, not regular column', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity<Post>(Post).property<Date>('createdAt').isRequired();
      mb._finalize();
      const meta = registry.getEntity(Post);
      expect(meta!.shadowProperties?.has('createdAt')).toBe(true);
      const regularCol = meta!.columns.find((c) => c.propertyName === 'createdAt');
      expect(regularCol).toBeUndefined();
    });
  });
});
