import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, ManyToOne, OneToMany, PrimaryKey } from '@ts-linq/metadata';
import { EntityState } from '@ts-linq/types';

import { ChangeTracker } from '../src/ChangeTracker';
import { DbContext } from '../src/DbContext';
import { TestProvider } from './stubs/TestProvider';

// ─── Fixtures ────────────────────────────────────────────────────────────────

@Entity()
class Blog {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;

  @OneToMany(() => Post, { inverseSide: 'blog' })
  posts?: Post[];
}

@Entity()
class Post {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  title!: string;

  @ManyToOne(() => Blog, { foreignKey: 'blogId' })
  blog?: Blog;
}

class BlogContext extends DbContext {
  blogs = this.defineSet(Blog);
  posts = this.defineSet(Post);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeContext(): BlogContext {
  return new BlogContext({ provider: new TestProvider('test') });
}

// ─── trackGraph ──────────────────────────────────────────────────────────────

describe('ChangeTracker.trackGraph', () => {
  it('calls callback once for root with no navigations', () => {
    const ct = new ChangeTracker();
    const blog = Object.assign(new Blog(), { id: 1, name: 'Tech' });
    const nodes: string[] = [];
    ct.trackGraph(blog, Blog, (node) => {
      nodes.push(node.entry.entityClass.name);
    });
    expect(nodes).toEqual(['Blog']);
  });

  it('visits root and all reachable children exactly once', () => {
    const ct = new ChangeTracker();
    const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
    const p2 = Object.assign(new Post(), { id: 2, title: 'B' });
    const blog = Object.assign(new Blog(), { id: 10, name: 'Tech', posts: [p1, p2] });

    const visited: object[] = [];
    ct.trackGraph(blog, Blog, (node) => {
      visited.push(node.entry.entity as object);
    });

    expect(visited).toHaveLength(3);
    expect(visited).toContain(blog);
    expect(visited).toContain(p1);
    expect(visited).toContain(p2);
  });

  it('does not visit any entity more than once (cycle-safe)', () => {
    const ct = new ChangeTracker();
    const p1 = new Post();
    p1.id = 1;
    p1.title = 'Cyclic';
    const blog = Object.assign(new Blog(), { id: 10, name: 'Tech', posts: [p1] });
    // introduce cycle: post references the same blog
    p1.blog = blog;

    const visited: object[] = [];
    ct.trackGraph(blog, Blog, (node) => {
      visited.push(node.entry.entity as object);
    });

    expect(visited).toHaveLength(2);
  });

  it('exposes inboundNavigation correctly', () => {
    const ct = new ChangeTracker();
    const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
    const blog = Object.assign(new Blog(), { id: 10, name: 'Tech', posts: [p1] });

    const navNames: (string | undefined)[] = [];
    ct.trackGraph(blog, Blog, (node) => {
      navNames.push(node.inboundNavigation);
    });

    expect(navNames[0]).toBeUndefined(); // root
    expect(navNames[1]).toBe('posts');
  });

  it('allows callback to set entity state', () => {
    const ct = new ChangeTracker();
    const p1 = Object.assign(new Post(), { id: 1, title: 'A' });
    const blog = Object.assign(new Blog(), { id: 10, name: 'Tech', posts: [p1] });

    ct.trackGraph(blog, Blog, (node) => {
      node.entry.state = node.entry.isKeySet ? EntityState.Modified : EntityState.Added;
    });

    expect(ct.getEntityState(blog)).toBe(EntityState.Modified);
    expect(ct.getEntityState(p1)).toBe(EntityState.Modified);
  });

  it('tracks entities as Added when PK is not set', () => {
    const ct = new ChangeTracker();
    const p1 = Object.assign(new Post(), { title: 'New' }); // no id
    const blog = Object.assign(new Blog(), { name: 'New Blog', posts: [p1] }); // no id

    ct.trackGraph(blog, Blog, (node) => {
      node.entry.state = node.entry.isKeySet ? EntityState.Modified : EntityState.Added;
    });

    expect(ct.getEntityState(blog)).toBe(EntityState.Added);
    expect(ct.getEntityState(p1)).toBe(EntityState.Added);
  });
});

// ─── EntityEntry.isKeySet ────────────────────────────────────────────────────

describe('EntityEntry.isKeySet', () => {
  it('returns true when PK is a positive integer', () => {
    const ct = new ChangeTracker();
    const blog = Object.assign(new Blog(), { id: 5, name: 'X' });
    ct.trackGraph(blog, Blog, (node) => {
      if (node.entry.entity === blog) {
        expect(node.entry.isKeySet).toBe(true);
      }
    });
  });

  it('returns false when PK is 0', () => {
    const ct = new ChangeTracker();
    const blog = Object.assign(new Blog(), { id: 0, name: 'X' });
    ct.trackGraph(blog, Blog, (node) => {
      if (node.entry.entity === blog) {
        expect(node.entry.isKeySet).toBe(false);
      }
    });
  });

  it('returns false when PK is undefined', () => {
    const ct = new ChangeTracker();
    const blog = new Blog();
    blog.name = 'X';
    ct.trackGraph(blog, Blog, (node) => {
      if (node.entry.entity === blog) {
        expect(node.entry.isKeySet).toBe(false);
      }
    });
  });
});

// ─── EntityEntry.state getter/setter ─────────────────────────────────────────

describe('EntityEntry.state setter', () => {
  it('sets entity to Added via setState', () => {
    const ct = new ChangeTracker();
    const blog = Object.assign(new Blog(), { id: 1, name: 'X' });
    ct.trackGraph(blog, Blog, (node) => {
      node.entry.state = EntityState.Added;
    });
    expect(ct.getEntityState(blog)).toBe(EntityState.Added);
  });

  it('sets entity to Deleted via setState', () => {
    const ct = new ChangeTracker();
    const blog = Object.assign(new Blog(), { id: 1, name: 'X' });
    ct.trackGraph(blog, Blog, (node) => {
      node.entry.state = EntityState.Deleted;
    });
    expect(ct.getEntityState(blog)).toBe(EntityState.Deleted);
  });
});

// ─── autoDetectChangesEnabled ────────────────────────────────────────────────

describe('autoDetectChangesEnabled', () => {
  it('defaults to true', () => {
    const ct = new ChangeTracker();
    expect(ct.autoDetectChangesEnabled).toBe(true);
  });

  it('when false, saveChanges does NOT auto-detect mutations', async () => {
    const ctx = makeContext();
    const blog = Object.assign(new Blog(), { id: 1, name: 'Old' });
    ctx.changeTracker.attach(blog, Blog);
    ctx.changeTracker.autoDetectChangesEnabled = false;

    // Mutate without explicit update()
    blog.name = 'Changed';

    // Because auto-detect is off and we never call detectChanges(), no change recorded
    const changes = ctx.changeTracker.getChanges();
    expect(changes).toHaveLength(0);
  });

  it('when false, explicit detectChanges() picks up mutations', () => {
    const ct = new ChangeTracker();
    const blog = Object.assign(new Blog(), { id: 1, name: 'Old' });
    ct.attach(blog, Blog);
    ct.autoDetectChangesEnabled = false;

    blog.name = 'Changed';

    // No changes yet
    expect(ct.getChanges()).toHaveLength(0);

    // Explicit call
    ct.detectChanges();
    expect(ct.getChanges()).toHaveLength(1);
    expect(ct.getEntityState(blog)).toBe(EntityState.Modified);
  });

  it('when false, saveChanges does not call detectChanges internally', async () => {
    const ctx = makeContext();
    const detectSpy = jest.spyOn(ctx.changeTracker, 'detectChanges');

    ctx.changeTracker.autoDetectChangesEnabled = false;

    const blog = Object.assign(new Blog(), { id: 1, name: 'Blog' });
    ctx.changeTracker.add(blog, Blog);

    await ctx.saveChanges();

    expect(detectSpy).not.toHaveBeenCalled();
    detectSpy.mockRestore();
  });

  it('when true (default), saveChanges calls detectChanges internally', async () => {
    const ctx = makeContext();
    const detectSpy = jest.spyOn(ctx.changeTracker, 'detectChanges');

    const blog = Object.assign(new Blog(), { id: 1, name: 'Blog' });
    ctx.changeTracker.add(blog, Blog);

    await ctx.saveChanges();

    expect(detectSpy).toHaveBeenCalledTimes(1);
    detectSpy.mockRestore();
  });
});
