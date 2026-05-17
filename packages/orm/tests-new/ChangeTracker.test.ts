import { beforeEach, describe, expect, it } from '@jest/globals';
import { EntityState } from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { ChangeTracker } from '../src/ChangeTracker';

@Entity({ name: 'users' })
class User {
  @PrimaryKey()
  @Column()
  id!: number;

  @Column()
  name!: string;

  @Column()
  email!: string;
}

@Entity({ name: 'products' })
class Product {
  @PrimaryKey()
  @Column()
  id!: number;

  @Column()
  title!: string;

  @Column()
  price!: number;
}

describe('ChangeTracker', () => {
  let tracker: ChangeTracker;

  beforeEach(() => {
    tracker = new ChangeTracker();
  });

  describe('add()', () => {
    it('should track entity as Added', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Added);
    });

    it('should track multiple entities as Added', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });

      tracker.add(user1, User);
      tracker.add(user2, User);

      expect(tracker.getEntityState(user1)).toBe(EntityState.Added);
      expect(tracker.getEntityState(user2)).toBe(EntityState.Added);
    });

    it('should include Added entities in getChanges()', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      const changes = tracker.getChanges();

      expect(changes).toHaveLength(1);
      expect(changes[0].state).toBe(EntityState.Added);
      expect(changes[0].entity).toBe(user);
    });

    it('should track different entity types separately', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const product = Object.assign(new Product(), { id: 1, title: 'Widget', price: 9.99 });

      tracker.add(user, User);
      tracker.add(product, Product);

      const changes = tracker.getChanges();
      expect(changes).toHaveLength(2);
    });
  });

  describe('update()', () => {
    it('should track entity as Modified', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.update(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should store original values for new tracked entity', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.update(user, User);
      user.name = 'Johnny';

      const changes = tracker.getChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].originalValues).toBeDefined();
      expect((changes[0].originalValues as any)?.name).toBe('John');
    });

    it('should update existing Added entity to Modified', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      tracker.update(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should include Modified entities in getChanges()', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.update(user, User);
      const changes = tracker.getChanges();

      expect(changes).toHaveLength(1);
      expect(changes[0].state).toBe(EntityState.Modified);
    });
  });

  describe('remove()', () => {
    it('should track entity as Deleted', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.remove(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Deleted);
    });

    it('should update existing Added entity to Deleted', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      tracker.remove(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Deleted);
    });

    it('should update existing Unchanged entity to Deleted', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);
      tracker.remove(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Deleted);
    });

    it('should include Deleted entities in getChanges()', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.remove(user, User);
      const changes = tracker.getChanges();

      expect(changes).toHaveLength(1);
      expect(changes[0].state).toBe(EntityState.Deleted);
    });
  });

  describe('attach()', () => {
    it('should track entity as Unchanged', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Unchanged);
    });

    it('should store original values', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);
      const changes = tracker.getChanges();

      expect(changes).toHaveLength(0);
    });

    it('should not include Unchanged entities in getChanges()', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);
      const changes = tracker.getChanges();

      expect(changes).toHaveLength(0);
    });
  });

  describe('getEntityState()', () => {
    it('should return Unchanged for untracked entities', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      expect(tracker.getEntityState(user)).toBe(EntityState.Unchanged);
    });

    it('should return correct state for tracked entities', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });
      const user3 = Object.assign(new User(), { id: 3, name: 'Bob', email: 'bob@test.com' });
      const user4 = Object.assign(new User(), { id: 4, name: 'Alice', email: 'alice@test.com' });

      tracker.add(user1, User);
      tracker.update(user2, User);
      tracker.remove(user3, User);
      tracker.attach(user4, User);

      expect(tracker.getEntityState(user1)).toBe(EntityState.Added);
      expect(tracker.getEntityState(user2)).toBe(EntityState.Modified);
      expect(tracker.getEntityState(user3)).toBe(EntityState.Deleted);
      expect(tracker.getEntityState(user4)).toBe(EntityState.Unchanged);
    });
  });

  describe('getChanges()', () => {
    it('should return empty array when no changes', () => {
      const changes = tracker.getChanges();
      expect(changes).toHaveLength(0);
    });

    it('should return only entities with changes', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });
      const user3 = Object.assign(new User(), { id: 3, name: 'Bob', email: 'bob@test.com' });

      tracker.add(user1, User);
      tracker.attach(user2, User);
      tracker.remove(user3, User);

      const changes = tracker.getChanges();
      expect(changes).toHaveLength(2);
      expect(changes.some((c) => c.state === EntityState.Unchanged)).toBe(false);
    });

    it('should return all types of changes', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });
      const user3 = Object.assign(new User(), { id: 3, name: 'Bob', email: 'bob@test.com' });

      tracker.add(user1, User);
      tracker.update(user2, User);
      tracker.remove(user3, User);

      const changes = tracker.getChanges();
      expect(changes).toHaveLength(3);

      const states = changes.map((c) => c.state);
      expect(states).toContain(EntityState.Added);
      expect(states).toContain(EntityState.Modified);
      expect(states).toContain(EntityState.Deleted);
    });
  });

  describe('acceptAllChanges()', () => {
    it('should mark Added entities as Unchanged', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      tracker.acceptAllChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Unchanged);
    });

    it('should mark Modified entities as Unchanged', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.update(user, User);
      tracker.acceptAllChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Unchanged);
    });

    it('should remove Deleted entities from tracking', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.remove(user, User);
      tracker.acceptAllChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Unchanged);
      expect(tracker.getChanges()).toHaveLength(0);
    });

    it('should update original values for remaining entities', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      user.name = 'Johnny';
      tracker.acceptAllChanges();

      user.name = 'Jonathan';
      tracker.detectChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should clear all changes', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });
      const user3 = Object.assign(new User(), { id: 3, name: 'Bob', email: 'bob@test.com' });

      tracker.add(user1, User);
      tracker.update(user2, User);
      tracker.remove(user3, User);

      tracker.acceptAllChanges();

      expect(tracker.getChanges()).toHaveLength(0);
    });
  });

  describe('clear()', () => {
    it('should remove all tracked entities', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });

      tracker.add(user1, User);
      tracker.update(user2, User);

      tracker.clear();

      expect(tracker.getChanges()).toHaveLength(0);
      expect(tracker.getEntityState(user1)).toBe(EntityState.Unchanged);
      expect(tracker.getEntityState(user2)).toBe(EntityState.Unchanged);
    });

    it('should work on empty tracker', () => {
      expect(() => tracker.clear()).not.toThrow();
    });
  });

  describe('detectChanges()', () => {
    it('should detect property changes in Unchanged entities', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);
      user.name = 'Johnny';
      tracker.detectChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should not affect Added entities', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      user.name = 'Johnny';
      tracker.detectChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Added);
    });

    it('should not affect already Modified entities', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.update(user, User);
      user.name = 'Johnny';
      tracker.detectChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should detect multiple property changes', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);
      user.name = 'Johnny';
      user.email = 'johnny@test.com';
      tracker.detectChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should not mark entity as Modified if unchanged', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);
      tracker.detectChanges();

      expect(tracker.getEntityState(user)).toBe(EntityState.Unchanged);
    });

    it('should detect changes in multiple entities', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 2, name: 'Jane', email: 'jane@test.com' });

      tracker.attach(user1, User);
      tracker.attach(user2, User);

      user1.name = 'Johnny';
      tracker.detectChanges();

      expect(tracker.getEntityState(user1)).toBe(EntityState.Modified);
      expect(tracker.getEntityState(user2)).toBe(EntityState.Unchanged);
    });
  });

  describe('edge cases', () => {
    it('should handle entity with no properties', () => {
      @Entity()
      class EmptyEntity {}

      const entity = new EmptyEntity();
      tracker.add(entity, EmptyEntity);

      expect(tracker.getEntityState(entity)).toBe(EntityState.Added);
    });

    it('should handle entity with null values', () => {
      const user = Object.assign(new User(), { id: 1, name: null as any, email: null as any });

      tracker.add(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Added);
    });

    it('should handle entity with undefined values', () => {
      const user = Object.assign(new User(), {
        id: 1,
        name: undefined as any,
        email: undefined as any
      });

      tracker.add(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Added);
    });

    it('should handle numeric zero values', () => {
      const product = Object.assign(new Product(), { id: 0, title: 'Free', price: 0 });

      tracker.add(product, Product);

      expect(tracker.getEntityState(product)).toBe(EntityState.Added);
    });

    it('should handle empty string values', () => {
      const user = Object.assign(new User(), { id: 1, name: '', email: '' });

      tracker.add(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Added);
    });

    it('should track same entity reference only once', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      tracker.add(user, User);

      expect(tracker.getChanges()).toHaveLength(1);
    });

    it('should track different instances as separate entities', () => {
      const user1 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });
      const user2 = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user1, User);
      tracker.add(user2, User);

      expect(tracker.getChanges()).toHaveLength(2);
    });
  });

  describe('state transitions', () => {
    it('should allow Added -> Modified transition', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      tracker.update(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should allow Added -> Deleted transition', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.add(user, User);
      tracker.remove(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Deleted);
    });

    it('should allow Unchanged -> Modified transition', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);
      tracker.update(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Modified);
    });

    it('should allow Unchanged -> Deleted transition', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.attach(user, User);
      tracker.remove(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Deleted);
    });

    it('should allow Modified -> Deleted transition', () => {
      const user = Object.assign(new User(), { id: 1, name: 'John', email: 'john@test.com' });

      tracker.update(user, User);
      tracker.remove(user, User);

      expect(tracker.getEntityState(user)).toBe(EntityState.Deleted);
    });
  });
});
