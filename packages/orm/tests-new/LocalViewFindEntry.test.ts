/**
 * Unit tests for P1-29: DbSet.Local, FindEntry, Find / FindAsync
 *
 * Covers:
 *  - ChangeTracker.getLocalView — lazy creation, population from existing tracked entities
 *  - LocalView change notifications (added / modified / removed)
 *  - LocalView.toArray / count / [Symbol.iterator]
 *  - LocalView.subscribe / unsubscribe
 *  - ChangeTracker.findEntry — single PK, composite PK, not-found case
 *  - ChangeTracker.entries — all entries regardless of state
 *  - DbSet.find (via tracker) — hit and miss cases
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { EntityState } from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { ChangeTracker } from '../src/ChangeTracker';
import { EntityEntry } from '../src/changetracker/EntityEntry';
import type { LocalViewChange } from '../src/LocalView';

// ── Test entities ─────────────────────────────────────────────────────────────

@Entity({ name: 'posts' })
class Post {
  @PrimaryKey()
  @Column()
  id!: number;

  @Column()
  title!: string;
}

/** Entity with a composite primary key (orderId + lineId). */
@Entity({ name: 'order_lines' })
class OrderLine {
  @PrimaryKey()
  @Column()
  orderId!: number;

  @PrimaryKey()
  @Column()
  lineId!: number;

  @Column()
  quantity!: number;
}

// ── LocalView tests ───────────────────────────────────────────────────────────

describe('LocalView (P1-29)', () => {
  let tracker: ChangeTracker;

  beforeEach(() => {
    tracker = new ChangeTracker();
  });

  // ── subscribe / unsubscribe ─────────────────────────────────────────────────

  describe('subscribe / unsubscribe', () => {
    it('subscriber receives "added" notification when entity is attached', () => {
      const view = tracker.getLocalView<Post>(Post);
      const events: LocalViewChange<Post>[] = [];
      view.subscribe((ch) => events.push(ch));

      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('added');
      expect(events[0].entity).toBe(post);
    });

    it('unsubscribe stops receiving events', () => {
      const view = tracker.getLocalView<Post>(Post);
      const events: LocalViewChange<Post>[] = [];
      const off = view.subscribe((ch) => events.push(ch));

      const p1 = Object.assign(new Post(), { id: 1, title: 'First' });
      tracker.attach(p1, Post);
      off(); // ← unsubscribe

      const p2 = Object.assign(new Post(), { id: 2, title: 'Second' });
      tracker.attach(p2, Post);

      // Only the event before unsubscribe
      expect(events).toHaveLength(1);
    });

    it('multiple subscribers each receive the event', () => {
      const view = tracker.getLocalView<Post>(Post);
      let countA = 0;
      let countB = 0;
      view.subscribe(() => countA++);
      view.subscribe(() => countB++);

      tracker.attach(Object.assign(new Post(), { id: 1, title: 'Hi' }), Post);

      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });
  });

  // ── toArray / count / iterator ──────────────────────────────────────────────

  describe('toArray / count / iterator', () => {
    it('toArray returns all non-deleted tracked entities', () => {
      const view = tracker.getLocalView<Post>(Post);
      const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
      const p2 = Object.assign(new Post(), { id: 2, title: 'B' });
      const p3 = Object.assign(new Post(), { id: 3, title: 'C' });
      tracker.attach(p1, Post);
      tracker.attach(p2, Post);
      tracker.add(p3, Post); // Added state

      expect(view.toArray()).toEqual(expect.arrayContaining([p1, p2, p3]));
      expect(view.toArray()).toHaveLength(3);
    });

    it('deleted entities are excluded from toArray', () => {
      const view = tracker.getLocalView<Post>(Post);
      const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
      tracker.attach(p1, Post);
      tracker.remove(p1, Post);

      expect(view.toArray()).toHaveLength(0);
    });

    it('count reflects non-deleted entries only', () => {
      const view = tracker.getLocalView<Post>(Post);
      const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
      const p2 = Object.assign(new Post(), { id: 2, title: 'B' });
      tracker.attach(p1, Post);
      tracker.attach(p2, Post);
      tracker.remove(p1, Post);

      expect(view.count).toBe(1);
    });

    it('[Symbol.iterator] iterates non-deleted entities', () => {
      const view = tracker.getLocalView<Post>(Post);
      const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
      tracker.attach(p1, Post);

      const arr = [...view];
      expect(arr).toEqual([p1]);
    });
  });

  // ── change notifications ────────────────────────────────────────────────────

  describe('change notifications', () => {
    it('emits "modified" when entity state transitions to Modified', () => {
      const view = tracker.getLocalView<Post>(Post);
      const events: LocalViewChange<Post>[] = [];
      view.subscribe((ch) => events.push(ch));

      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post); // → added
      tracker.update(post, Post); // → modified

      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('modified');
    });

    it('emits "removed" when entity is marked Deleted', () => {
      const view = tracker.getLocalView<Post>(Post);
      const events: LocalViewChange<Post>[] = [];
      view.subscribe((ch) => events.push(ch));

      const post = Object.assign(new Post(), { id: 1, title: 'Hello' });
      tracker.attach(post, Post);
      tracker.remove(post, Post);

      const removed = events.find((e) => e.type === 'removed');
      expect(removed).toBeDefined();
      expect(removed!.entity).toBe(post);
    });

    it('add() on already-Added entity emits "modified"', () => {
      const view = tracker.getLocalView<Post>(Post);
      const events: LocalViewChange<Post>[] = [];
      view.subscribe((ch) => events.push(ch));

      const post = Object.assign(new Post(), { id: 1, title: 'New' });
      tracker.add(post, Post); // → Added (added event)
      tracker.add(post, Post); // state stays Added → modified event

      expect(events[0].type).toBe('added');
      expect(events[1].type).toBe('modified');
    });
  });

  // ── lazy creation with pre-existing entities ────────────────────────────────

  describe('lazy creation', () => {
    it('newly created LocalView is pre-populated with already-tracked entities', () => {
      const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
      const p2 = Object.assign(new Post(), { id: 2, title: 'B' });
      tracker.attach(p1, Post);
      tracker.attach(p2, Post);

      // LocalView created AFTER entities were tracked
      const view = tracker.getLocalView<Post>(Post);
      expect(view.toArray()).toHaveLength(2);
    });

    it('returns the same LocalView instance on repeated calls', () => {
      const v1 = tracker.getLocalView<Post>(Post);
      const v2 = tracker.getLocalView<Post>(Post);
      expect(v1).toBe(v2);
    });
  });

  // ── clear() / acceptAllChanges() ────────────────────────────────────────────

  describe('clear()', () => {
    it('LocalView is emptied when tracker is cleared', () => {
      const view = tracker.getLocalView<Post>(Post);
      tracker.attach(Object.assign(new Post(), { id: 1, title: 'A' }), Post);
      expect(view.count).toBe(1);

      tracker.clear();
      expect(view.count).toBe(0);
    });
  });

  describe('acceptAllChanges()', () => {
    it('removed Deleted entries are purged from LocalView', () => {
      const view = tracker.getLocalView<Post>(Post);
      const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
      const p2 = Object.assign(new Post(), { id: 2, title: 'B' });
      tracker.attach(p1, Post);
      tracker.attach(p2, Post);
      tracker.remove(p2, Post);

      tracker.acceptAllChanges();

      // p1 is still visible (Unchanged), p2 is purged (Deleted → removed)
      expect(view.toArray()).toEqual([p1]);
    });
  });
});

// ── ChangeTracker.findEntry tests ─────────────────────────────────────────────

describe('ChangeTracker.findEntry (P1-29)', () => {
  let tracker: ChangeTracker;

  beforeEach(() => {
    tracker = new ChangeTracker();
  });

  it('returns EntityEntry for a tracked entity by single PK', () => {
    const post = Object.assign(new Post(), { id: 42, title: 'Found' });
    tracker.attach(post, Post);

    const entry = tracker.findEntry(Post, 42);
    expect(entry).toBeInstanceOf(EntityEntry);
    expect(entry!.entity).toBe(post);
  });

  it('returns undefined when entity is not tracked', () => {
    const entry = tracker.findEntry(Post, 999);
    expect(entry).toBeUndefined();
  });

  it('finds entity by composite PK', () => {
    const line = Object.assign(new OrderLine(), { orderId: 1, lineId: 2, quantity: 5 });
    tracker.attach(line, OrderLine);

    // PK columns sorted alphabetically: lineId=2, orderId=1 → key JSON.stringify([2,1])
    const entry = tracker.findEntry(OrderLine, 2, 1);
    expect(entry).toBeInstanceOf(EntityEntry);
    expect(entry!.entity).toBe(line);
  });

  it('returns undefined when composite PK does not match', () => {
    tracker.attach(
      Object.assign(new OrderLine(), { orderId: 1, lineId: 2, quantity: 5 }),
      OrderLine
    );
    const entry = tracker.findEntry(OrderLine, 99, 99);
    expect(entry).toBeUndefined();
  });

  it('EntityEntry.state reflects current tracker state', () => {
    const post = Object.assign(new Post(), { id: 1, title: 'Test' });
    tracker.attach(post, Post);

    const entry = tracker.findEntry(Post, 1)!;
    expect(entry.state).toBe(EntityState.Unchanged);

    tracker.update(post, Post);
    const entry2 = tracker.findEntry(Post, 1)!;
    expect(entry2.state).toBe(EntityState.Modified);
  });

  it('returns entry for Added entities', () => {
    const post = Object.assign(new Post(), { id: 5, title: 'New' });
    tracker.add(post, Post);

    const entry = tracker.findEntry(Post, 5);
    expect(entry).toBeDefined();
    expect(entry!.state).toBe(EntityState.Added);
  });
});

// ── ChangeTracker.entries tests ───────────────────────────────────────────────

describe('ChangeTracker.entries (P1-29)', () => {
  let tracker: ChangeTracker;

  beforeEach(() => {
    tracker = new ChangeTracker();
  });

  it('returns all EntityEntry instances for a given type', () => {
    tracker.attach(Object.assign(new Post(), { id: 1, title: 'A' }), Post);
    tracker.attach(Object.assign(new Post(), { id: 2, title: 'B' }), Post);
    tracker.add(Object.assign(new Post(), { id: 3, title: 'C' }), Post);

    const all = tracker.entries(Post);
    expect(all).toHaveLength(3);
    expect(all.every((e) => e instanceof EntityEntry)).toBe(true);
  });

  it('includes Deleted entries', () => {
    const p = Object.assign(new Post(), { id: 1, title: 'A' });
    tracker.attach(p, Post);
    tracker.remove(p, Post);

    const all = tracker.entries(Post);
    expect(all).toHaveLength(1);
    expect(all[0].state).toBe(EntityState.Deleted);
  });

  it('returns empty array when nothing is tracked for the type', () => {
    expect(tracker.entries(Post)).toHaveLength(0);
  });

  it('does not return entries for other entity types', () => {
    tracker.attach(Object.assign(new Post(), { id: 1, title: 'X' }), Post);
    tracker.attach(
      Object.assign(new OrderLine(), { orderId: 1, lineId: 1, quantity: 10 }),
      OrderLine
    );

    expect(tracker.entries(Post)).toHaveLength(1);
    expect(tracker.entries(OrderLine)).toHaveLength(1);
  });
});

// ── DbSet.find (tracker-level equivalent) ─────────────────────────────────────

describe('DbSet.find via ChangeTracker (P1-29)', () => {
  /**
   * DbSet.find() delegates entirely to ChangeTracker.findEntry().
   * This suite verifies the underlying semantics at the tracker level,
   * covering the same cases that DbSet.find() would exercise.
   */

  let tracker: ChangeTracker;

  beforeEach(() => {
    tracker = new ChangeTracker();
  });

  it('returns entity when found by PK in tracker', () => {
    const post = Object.assign(new Post(), { id: 7, title: 'Found' });
    tracker.attach(post, Post);

    // Simulate DbSet.find(7)
    const entry = tracker.findEntry(Post, 7);
    expect(entry?.entity).toBe(post);
  });

  it('returns undefined (null in DbSet) when entity is not in tracker', () => {
    const entry = tracker.findEntry(Post, 999);
    expect(entry).toBeUndefined();
  });

  it('finds entity added via add() with PK', () => {
    const post = Object.assign(new Post(), { id: 10, title: 'Added' });
    tracker.add(post, Post);

    const entry = tracker.findEntry(Post, 10);
    expect(entry?.entity).toBe(post);
    expect(entry?.state).toBe(EntityState.Added);
  });
});
