import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { Column, Entity, MetadataStorage, PrimaryKey } from '@ts-linq/metadata';
import { PostgresProvider } from '@ts-linq/provider-postgres';
import { QueryBuilder } from '@ts-linq/query/internal';

describe('PostgreSQL Provider + QueryBuilder Integration', () => {
  @Entity({ name: 'users' })
  class User {
    @PrimaryKey()
    public id!: number;

    @Column({ type: 'INTEGER' })
    public age!: number;

    @Column({ type: 'TEXT' })
    public name!: string;
  }

  beforeAll(() => {
    // Ensure metadata is registered so PostgresDialect can resolve table/columns
    const meta = MetadataStorage.getEntity(User);
    if (!meta) {
      throw new Error('User metadata must be registered for Postgres integration tests');
    }
  });

  describe('Parameter Placeholders', () => {
    it('should use $1, $2, $3 for parameterized queries', () => {
      const dialect = new PostgresDialect();
      const qb = new QueryBuilder(dialect, undefined, 'postgresql');
      const { query, parameters } = qb.generateSql(User, {
        where: [
          {
            condition: 'age > ? AND name = ? AND id <> ?',
            parameters: [18, 'John', 10]
          }
        ]
      });

      expect(query).toContain('FROM "users"');
      expect(query).toContain('age > $1 AND name = $2 AND id <> $3');
      expect(parameters).toEqual([18, 'John', 10]);
    });

    it('should handle nested parameter numbering in subqueries', () => {
      const dialect = new PostgresDialect();
      const qb = new QueryBuilder(dialect, undefined, 'postgresql');
      const { query, parameters } = qb.generateSql(User, {
        where: [
          {
            condition:
              'age > ? AND id IN (SELECT user_id FROM orders WHERE total > ? AND status = ?)',
            parameters: [18, 100, 'paid']
          }
        ]
      });

      expect(query).toContain(
        'age > $1 AND id IN (SELECT user_id FROM orders WHERE total > $2 AND status = $3)'
      );
      expect(parameters).toEqual([18, 100, 'paid']);
    });
  });

  describe('PostgreSQL-Specific Features', () => {
    it('should generate query with JSONB column access', () => {
      const dialect = new PostgresDialect();
      const qb = new QueryBuilder(dialect, undefined, 'postgresql');
      const { query, parameters } = qb.generateSql(User, {
        select: ['id', "metadata->>'role' as role"],
        where: {
          condition: "metadata->>'role' = ?",
          parameters: ['admin']
        } as const,
        orderBy: [{ column: 'id', direction: 'ASC' }]
      });

      expect(query).toContain("SELECT id, metadata->>'role' as role");
      expect(query).toContain('FROM "users"');
      expect(query).toContain("metadata->>'role' = $1");
      expect(parameters).toEqual(['admin']);
    });

    it('should use RETURNING clause for INSERT via PostgresProvider', async () => {
      const url = process.env.POSTGRES_URL;
      if (!url) return;

      const provider = new PostgresProvider({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
        database: process.env.POSTGRES_DB || 'test',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD
      });

      await provider.connect();

      const meta = MetadataStorage.getEntity(User);
      if (!meta) {
        throw new Error('User metadata not found for Postgres insert test');
      }

      await provider.executeNonQuery(
        'DROP TABLE IF EXISTS "users"; CREATE TABLE "users" (id SERIAL PRIMARY KEY, age INT, name TEXT, metadata JSONB)'
      );

      const created = await provider.insert<User>({ age: 30, name: 'Alice' } as User, User);

      expect(created.id).toBeGreaterThan(0);
      expect(created.name).toBe('Alice');

      await provider.disconnect();
    });

    it('should use "double quotes" for identifier escaping', () => {
      const dialect = new PostgresDialect();
      const quoted = dialect.quoteIdentifier('user');
      const quotedWithQuotes = dialect.quoteIdentifier('co"l');

      expect(quoted).toBe('"user"');
      expect(quotedWithQuotes).toBe('"co""l"');
    });
  });

  describe('CTE (Common Table Expressions)', () => {
    it('should generate WITH clause for CTE', () => {
      const dialect = new PostgresDialect();
      const qb = new QueryBuilder(dialect, undefined, 'postgresql');
      const { query, parameters } = qb.generateSql(User, {
        cte: {
          name: 'active_users',
          sql: 'SELECT id, age, name FROM users WHERE age > ?'
        },
        where: {
          condition: 'age > ?',
          parameters: [18]
        } as const
      });

      expect(
        query.startsWith('WITH active_users AS (SELECT id, age, name FROM users WHERE age > $1)')
      ).toBe(true);
      expect(query).toContain('FROM "users"');
      expect(parameters).toEqual([18]);
    });
  });

  describe('Transactions', () => {
    it('should execute multiple queries in single transaction and rollback on error', async () => {
      const url = process.env.POSTGRES_URL;
      if (!url) return;

      const provider = new PostgresProvider({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
        database: process.env.POSTGRES_DB || 'test',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD
      });

      await provider.connect();

      await provider.executeNonQuery('DROP TABLE IF EXISTS "tx_users"');
      await provider.executeNonQuery(
        'CREATE TABLE "tx_users" (id SERIAL PRIMARY KEY, name TEXT NOT NULL)'
      );

      await provider.beginTransaction();
      await provider.executeNonQuery('INSERT INTO "tx_users" (name) VALUES ($1)', ['ok-1']);
      await provider.executeNonQuery('INSERT INTO "tx_users" (name) VALUES ($1)', ['ok-2']);
      await provider.rollbackTransaction();

      const rows = await provider.executeQuery<{ count: number }>(
        'SELECT COUNT(*)::int as count FROM "tx_users"'
      );
      expect(rows[0]?.count).toBe(0);

      await provider.disconnect();
    });
  });
});

//
