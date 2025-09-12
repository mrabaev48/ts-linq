import 'reflect-metadata';
import { QueryBuilder } from '../src/query/QueryBuilder';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { QueryOptions } from '../src/types';

// Define test entity inside function to ensure decorators execute properly
function createQueryTestEntity() {
  @Entity()
  class QueryTestEntity {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;

    @Column()
    age!: number;
  }
  return QueryTestEntity;
}

describe('QueryBuilder (SQL generation only)', () => {
  let provider: SQLiteProvider;
  let queryBuilder: QueryBuilder;
  let QueryTestEntity: ReturnType<typeof createQueryTestEntity>;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    // Create test entity
    QueryTestEntity = createQueryTestEntity();

    provider = new SQLiteProvider(':memory:');
    await provider.connect();

    const metadata = MetadataStorage.getEntity(QueryTestEntity)!;
    await provider.createTable(metadata);

    // Insert test data
    for (let i = 1; i <= 10; i++) {
      const entity = new QueryTestEntity();
      entity.name = `Name ${i}`;
      entity.age = 20 + i;
      await provider.insert(entity, QueryTestEntity);
    }

    queryBuilder = new QueryBuilder();
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  describe('basic operations', () => {
    it('should return all entities with toArray', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {});
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results).toHaveLength(10);
    });

    it('should count entities', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {});
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      const count = results.length;
      expect(count).toBe(10);
    });

    it('should check if any entities exist', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {});
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results.length > 0).toBe(true);
    });
  });

  describe('take and skip', () => {
    it('should limit results with take', async () => {
      const opts: QueryOptions = { limit: 5 };
      const sql = queryBuilder.generateSql(QueryTestEntity, opts);
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results).toHaveLength(5);
    });

    it('should skip results', async () => {
      const opts: QueryOptions = { offset: 5 };
      const sql = queryBuilder.generateSql(QueryTestEntity, opts);
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results).toHaveLength(5);
    });

    it('should combine take and skip for pagination', async () => {
      const opts: QueryOptions = { offset: 3, limit: 2 };
      const sql = queryBuilder.generateSql(QueryTestEntity, opts);
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect(results).toHaveLength(2);
    });
  });

  describe('ordering', () => {
    it('should order by ascending', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {
        orderBy: [{ column: 'age', direction: 'ASC' }]
      });
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect((results[0] as { age: number }).age).toBeLessThan((results[1] as { age: number }).age);
    });

    it('should order by descending', async () => {
      const sql = queryBuilder.generateSql(QueryTestEntity, {
        orderBy: [{ column: 'age', direction: 'DESC' }]
      });
      const results = await provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      expect((results[0] as { age: number }).age).toBeGreaterThan(
        (results[1] as { age: number }).age
      );
    });
  });

  describe('first operations (via SQL generation)', () => {
    it('should get first row using LIMIT 1', async () => {
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {
        orderBy: [{ column: 'id', direction: 'ASC' }],
        limit: 1
      });
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows).toHaveLength(1);
      expect((rows[0] as { id: number }).id).toBe(1);
    });

    it('should return empty when no results with LIMIT 1', async () => {
      await provider.executeNonQuery('DELETE FROM QueryTestEntity');
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, { limit: 1 });
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows).toHaveLength(0);
    });
  });

  describe('single-like checks (via SQL generation)', () => {
    it('should get one row when only one exists', async () => {
      await provider.executeNonQuery('DELETE FROM QueryTestEntity');
      const entity = new QueryTestEntity();
      entity.name = 'Single';
      entity.age = 25;
      await provider.insert(entity, QueryTestEntity);
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows).toHaveLength(1);
      expect((rows[0] as { name: string }).name).toBe('Single');
    });

    it('should return zero rows when none exist', async () => {
      await provider.executeNonQuery('DELETE FROM QueryTestEntity');
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows).toHaveLength(0);
    });

    it('should return multiple rows when multiple exist', async () => {
      const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
      const rows = await provider.executeQuery<Record<string, unknown>>(query, parameters);
      expect(rows.length).toBeGreaterThan(1);
    });
  });

  describe('distinct', () => {
    it('should generate DISTINCT select', async () => {
      const { query } = queryBuilder.generateSql(QueryTestEntity, { distinct: true });
      expect(query.toUpperCase()).toContain('SELECT DISTINCT');
    });
  });
});
