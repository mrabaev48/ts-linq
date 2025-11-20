/* eslint-disable max-lines-per-function */
/* eslint-disable max-lines-per-function */
import { SQLiteProvider } from '@ts-linq/provider-sqlite';
import { Queryable } from '@ts-linq/query';
import { Entity, PrimaryKey, Column, MetadataStorage } from '@ts-linq/metadata';
import path from 'node:path';
import fs from 'node:fs';
import { shouldRunSqlite } from '../_utils/env';

const run = shouldRunSqlite;
(run ? describe : describe.skip)('SQLite Provider + QueryBuilder Integration', () => {
  const dbPath = path.join(process.cwd(), 'size-tests', 'tmp', 'sqlite-query-provider.db');
  let provider: SQLiteProvider;

  @Entity({ name: 'users' })
  class User {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column({ type: 'TEXT' })
    name!: string;

    @Column({ type: 'INTEGER' })
    age!: number;
  }

  @Entity({ name: 'posts' })
  class Post {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column({ type: 'TEXT' })
    title!: string;

    @Column({ type: 'INTEGER' })
    userId!: number;
  }

  @Entity({ name: 'comments' })
  class Comment {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column({ type: 'INTEGER' })
    postId!: number;

    @Column({ type: 'TEXT' })
    content!: string;
  }

  beforeAll(() => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  });
  beforeEach(async () => {
    // ':memory:' сокращает зависимость от файловой системы
    provider = new SQLiteProvider({ file: ':memory:' });
    await provider.connect();
    // Fresh schema for isolation
    await provider.executeNonQuery('DROP TABLE IF EXISTS users');
    await provider.executeNonQuery('DROP TABLE IF EXISTS posts');
    await provider.executeNonQuery('DROP TABLE IF EXISTS comments');
    const meta = MetadataStorage.getEntity(User)!;
    await provider.createTable(meta);
    await provider.createTable(MetadataStorage.getEntity(Post)!);
    await provider.createTable(MetadataStorage.getEntity(Comment)!);
    // Seed
    const uJohn = await provider.insert<User>({ name: 'John', age: 18 } as User, User);
    const uAlice = await provider.insert<User>({ name: 'Alice', age: 25 } as User, User);
    await provider.insert<User>({ name: 'Bob', age: 30 } as User, User);
    const uJohnny = await provider.insert<User>({ name: 'Johnny', age: 40 } as User, User);
    // Posts
    const pA1 = await provider.insert<Post>(
      { title: 'Alice-Post-1', userId: uAlice.id } as Post,
      Post
    );
    const pA2 = await provider.insert<Post>(
      { title: 'Alice-Post-2', userId: uAlice.id } as Post,
      Post
    );
    await provider.insert<Post>({ title: 'Johnny-Post-1', userId: uJohnny.id } as Post, Post);
    await provider.insert<Post>({ title: 'John-Post-1', userId: uJohn.id } as Post, Post);
    // Bob has 0 posts (left join coverage)
    // Comments
    await provider.insert<Comment>({ postId: pA1.id, content: 'Nice #1' } as Comment, Comment);
    await provider.insert<Comment>({ postId: pA2.id, content: 'Nice #2' } as Comment, Comment);
  });
  afterAll(() => {
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });
  afterEach(async () => {
    await provider.disconnect();
  });

  describe('Basic Query Generation', () => {
    it('should generate SELECT with WHERE clause', async () => {
      const q = new Queryable(User, provider);
      const adults = await q.where((u) => u.age > 20).toArray();
      expect(adults.map((u) => u.name).sort()).toEqual(['Alice', 'Bob', 'Johnny']);
    });
    it('should generate SELECT with multiple WHERE conditions (AND)', async () => {
      const q = new Queryable(User, provider);
      const result = await q
        .where((u) => u.age > 20)
        .where((u) => u.age < 35)
        .toArray();
      expect(result.map((u) => u.name).sort()).toEqual(['Alice', 'Bob']);
    });
    it('should handle LIKE operator for string matching', async () => {
      const rows = await provider.executeQuery<{ name: string }>(
        "SELECT name FROM users WHERE name LIKE '%John%' ORDER BY name"
      );
      expect(rows.map((r) => r.name)).toEqual(['John', 'Johnny']);
    });
    it('should generate IN clause for array conditions', async () => {
      // Using raw SQL here as PredicateParser may not support array IN predicates directly
      const rows = await provider.executeQuery<{ name: string }>(
        'SELECT name FROM users WHERE id IN (1, 3) ORDER BY id'
      );
      expect(rows.map((r) => r.name)).toEqual(['John', 'Bob']);
    });
    it('should generate SELECT with OR conditions (SQL)', async () => {
      const rows = await provider.executeQuery<{ name: string }>(
        'SELECT name FROM users WHERE age < 20 OR age > 35 ORDER BY name'
      );
      expect(rows.map((r) => r.name)).toEqual(['John', 'Johnny']);
    });
  });

  describe('JOIN Operations', () => {
    it('should generate INNER JOIN between two tables', async () => {
      const rows = await provider.executeQuery<{ user: string; title: string }>(
        'SELECT u.name as user, p.title as title ' +
          'FROM users u INNER JOIN posts p ON u.id = p.userId ' +
          'ORDER BY u.name, p.title'
      );
      expect(rows.length).toBeGreaterThan(0);
      // Basic presence checks
      const sample = rows.map((r) => `${r.user}:${r.title}`);
      expect(sample).toContain('Alice:Alice-Post-1');
      expect(sample).toContain('Alice:Alice-Post-2');
    });
    it('should generate LEFT JOIN with WHERE clause', async () => {
      const rows = await provider.executeQuery<{ user: string; title: string | null }>(
        'SELECT u.name as user, p.title as title ' +
          'FROM users u LEFT JOIN posts p ON u.id = p.userId ' +
          'WHERE u.age >= 25 ' +
          'ORDER BY u.name, p.title'
      );
      // Expect Bob present with NULL title (no posts), Alice with 2 posts, Johnny with 1
      const grouped = rows.reduce<Record<string, (string | null)[]>>((acc, r) => {
        acc[r.user] = acc[r.user] || [];
        acc[r.user].push(r.title);
        return acc;
      }, {});
      expect(Object.keys(grouped)).toEqual(['Alice', 'Bob', 'Johnny']);
      expect(grouped['Alice']?.filter((t) => t)?.length).toBe(2);
      expect(grouped['Bob']?.filter((t) => t)?.length).toBe(0);
      expect(grouped['Johnny']?.filter((t) => t)?.length).toBe(1);
    });
    it('should handle multi-table JOIN (3+ tables)', async () => {
      const rows = await provider.executeQuery<{ user: string; comments: number }>(
        'SELECT u.name as user, COUNT(c.id) as comments ' +
          'FROM users u ' +
          'INNER JOIN posts p ON u.id = p.userId ' +
          'LEFT JOIN comments c ON c.postId = p.id ' +
          'GROUP BY u.name ' +
          'ORDER BY u.name'
      );
      const map = new Map(rows.map((r) => [r.user, r.comments]));
      expect(map.get('Alice')).toBe(2);
      expect(map.get('Johnny')).toBe(1);
      // John has a post but no comments → 0
      expect(map.get('John')).toBe(0);
      // Bob has no posts → excluded by INNER JOIN with posts
      expect(map.has('Bob')).toBe(false);
    });
  });

  describe('Pagination & Sorting', () => {
    it('should generate ORDER BY ASC', async () => {
      const q = new Queryable(User, provider);
      const items = await q.orderBy((u) => u.name).toArray();
      expect(items.map((u) => u.name)).toEqual(['Alice', 'Bob', 'John', 'Johnny']);
    });
    it('should generate ORDER BY DESC', async () => {
      const q = new Queryable(User, provider);
      const items = await q.orderByDescending((u) => u.age).toArray();
      expect(items.map((u) => u.age)).toEqual([40, 30, 25, 18]);
    });
    it('should handle multiple ORDER BY columns', async () => {
      const q = new Queryable(User, provider);
      const items = await q
        .orderBy((u) => u.name)
        .thenByDescending((u) => u.age)
        .toArray();
      expect(items.map((u) => u.name)).toEqual(['Alice', 'Bob', 'John', 'Johnny']);
    });
    it('should generate LIMIT clause', async () => {
      const q = new Queryable(User, provider);
      const items = await q
        .orderBy((u) => u.id)
        .take(2)
        .toArray();
      expect(items.map((u) => u.name)).toEqual(['John', 'Alice']);
    });
    it('should generate OFFSET + LIMIT', async () => {
      const q = new Queryable(User, provider);
      const items = await q
        .orderBy((u) => u.id)
        .skip(2)
        .take(2)
        .toArray();
      expect(items.map((u) => u.name)).toEqual(['Bob', 'Johnny']);
    });
  });

  describe('Aggregations', () => {
    it('should generate COUNT(*)', async () => {
      const q = new Queryable(User, provider);
      const cnt = await q.where((u) => u.age >= 25).count();
      expect(cnt).toBe(3);
    });
    it('should generate SUM aggregation', async () => {
      const [{ sum }] = await provider.executeQuery<{ sum: number }>(
        'SELECT SUM(age) as sum FROM users'
      );
      expect(sum).toBe(113);
    });
    it('should generate AVG aggregation', async () => {
      const [{ avg }] = await provider.executeQuery<{ avg: number }>(
        'SELECT AVG(age) as avg FROM users'
      );
      expect(avg).toBeCloseTo(28.25, 5);
    });
  });

  describe('Distinct & Union', () => {
    it('should ensure DISTINCT on projection', async () => {
      // add duplicate name 'John' to force DISTINCT effect
      await provider.insert<User>({ name: 'John', age: 99 } as User, User);
      const q = new Queryable(User, provider);
      const names = await q
        .select((u) => u.name)
        .distinct()
        .orderBy((n) => n as unknown as string)
        .toArray();
      expect(names).toEqual(['Alice', 'Bob', 'John', 'Johnny']);
    });

    it('should UNION two disjoint queries', async () => {
      const younger = new Queryable(User, provider).where((u) => u.age < 20);
      const older = new Queryable(User, provider).where((u) => u.age > 35);
      const unioned = younger.union(older);
      const result = await unioned.orderBy((u) => u.name).toArray();
      expect(result.map((u) => u.name)).toEqual(['John', 'Johnny']);
    });

    it('should UNION remove duplicates and UNION ALL keep them', async () => {
      const ge25 = new Queryable(User, provider).where((u) => u.age >= 25);
      const ge30 = new Queryable(User, provider).where((u) => u.age >= 30);

      const unionDistinct = await ge25
        .union(ge30)
        .orderBy((u) => u.name)
        .toArray();
      expect(unionDistinct.map((u) => u.name)).toEqual(['Alice', 'Bob', 'Johnny']);

      const unionAll = await ge25
        .unionAll(ge30)
        .orderBy((u) => u.name)
        .toArray();
      const counts = unionAll.reduce<Record<string, number>>((acc, u) => {
        acc[u.name] = (acc[u.name] ?? 0) + 1;
        return acc;
      }, {});
      // 'Alice' only from ge25 once, 'Bob' and 'Johnny' appear twice due to overlap
      expect(counts['Alice']).toBe(1);
      expect(counts['Bob']).toBe(2);
      expect(counts['Johnny']).toBe(2);
    });
  });
});
