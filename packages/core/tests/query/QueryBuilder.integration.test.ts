import 'reflect-metadata';
import { QueryBuilder } from '../../src/query/QueryBuilder';
import { EnhancedSqlCache } from '../../src/query/EnhancedSqlCache';
import type { SqlDialect } from '../../src/query/SqlDialect';
import { sql } from '../../src/query/SqlFunctions';
import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata, SqlLogger } from '../../src/types';

// Test entity for QueryBuilder integration
class TestUser {
  id!: number;
  name!: string;
  email!: string;
  age!: number;
}

describe('QueryBuilder with Enhanced SQL Cache Integration', () => {
  let queryBuilder: QueryBuilder;
  let enhancedCache: EnhancedSqlCache;
  let mockLogger: SqlLogger;

  beforeEach(() => {
    // Register metadata without decorators
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(TestUser, 'test_users');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
      { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false },
      { propertyName: 'age', columnName: 'age', type: 'INTEGER', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(TestUser, c));
    MetadataStorage.addPrimaryKey(TestUser, 'id');

    enhancedCache = new EnhancedSqlCache({
      maxSize: 100,
      defaultTtl: 60000,
      enableMetrics: true,
      enableLru: true
    });

    mockLogger = {
      cache: jest.fn()
    };

    // Create a mock dialect for testing
    const mockDialect: SqlDialect = {
      buildSelect: () => ({
        query: 'SELECT * FROM test_users',
        parameters: []
      })
    };

    queryBuilder = new QueryBuilder(mockDialect, mockLogger, 'test-provider', enhancedCache);
  });

  afterEach(() => {
    QueryBuilder.clearCache();
    enhancedCache.clear();
  });

  describe('Enhanced Cache Integration', () => {
    test('should use enhanced cache for SQL generation', () => {
      const options = {
        select: ['id', 'name'],
        where: [{ condition: 'age > ?', parameters: [18] }]
      };

      // First call should miss cache
      const result1 = queryBuilder.generateSql(TestUser, options);
      expect(result1.query).toBeDefined();
      expect(result1.parameters).toBeDefined();

      // Verify cache miss was logged
      expect(mockLogger.cache).toHaveBeenCalledWith({
        cache: 'sqlGen',
        hit: false,
        provider: 'test-provider'
      });

      // Second call should hit cache
      (mockLogger.cache as jest.Mock).mockClear();
      const result2 = queryBuilder.generateSql(TestUser, options);

      expect(result2.query).toBe(result1.query);
      expect(result2.parameters).toEqual(result1.parameters);

      // Verify cache hit was logged
      expect(mockLogger.cache).toHaveBeenCalledWith({
        cache: 'sqlGen',
        hit: true,
        provider: 'test-provider'
      });
    });

    test('should track cache metrics through QueryBuilder', () => {
      const options = {
        select: ['*'],
        where: []
      };

      // Generate some cache activity
      queryBuilder.generateSql(TestUser, options); // miss
      queryBuilder.generateSql(TestUser, options); // hit
      queryBuilder.generateSql(TestUser, options); // hit

      const metrics = queryBuilder.getCacheMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRatio).toBeCloseTo(2 / 3, 2);
      expect(metrics.currentSize).toBe(1);
    });

    test('should provide optimization insights through QueryBuilder', () => {
      const options1 = { select: ['name'], where: [] };
      const options2 = { select: ['email'], where: [] };

      // Create different cache entries with different access patterns
      queryBuilder.generateSql(TestUser, options1);
      for (let i = 0; i < 10; i++) {
        queryBuilder.generateSql(TestUser, options1); // Popular query
      }

      queryBuilder.generateSql(TestUser, options2);
      queryBuilder.generateSql(TestUser, options2); // Less popular query

      const insights = queryBuilder.getOptimizationInsights();
      expect(insights).toBeDefined();
      expect(insights.topAccessedEntries).toBeDefined();
      expect(insights.topAccessedEntries.length).toBe(2);
      expect(insights.topAccessedEntries[0].accessCount).toBeGreaterThan(
        insights.topAccessedEntries[1].accessCount
      );
    });

    test('should embed window function expressions in select list', () => {
      const options = {
        select: ['id', sql.rowNumber().over().partitionBy('name').orderBy('age', 'DESC').as('rn')],
        where: [] as any[]
      };
      // Use a dialect that outputs the select list to validate expression rendering
      const exprDialect: SqlDialect = {
        buildSelect: () => ({
          query: `SELECT ${options.select.join(', ')} FROM test_users`,
          parameters: []
        })
      };
      const localBuilder = new QueryBuilder(
        exprDialect,
        mockLogger,
        'test-provider',
        enhancedCache
      );
      const result = localBuilder.generateSql(TestUser, options);
      expect(result.query).toContain(
        'ROW_NUMBER() OVER (PARTITION BY name ORDER BY age DESC) AS rn'
      );
    });

    test('should handle cache key compression for complex queries', () => {
      // Create a complex query that would generate a long cache key
      const complexOptions = {
        select: ['id', 'name', 'email', 'age'],
        where: [
          { condition: 'age > ?', parameters: [18] },
          { condition: 'name LIKE ?', parameters: ['%john%'] },
          { condition: 'email IS NOT NULL', parameters: [] }
        ],
        orderBy: [
          { column: 'name', direction: 'ASC' as const },
          { column: 'age', direction: 'DESC' as const }
        ],
        limit: 50,
        offset: 100,
        distinct: true
      };

      const result1 = queryBuilder.generateSql(TestUser, complexOptions);
      const result2 = queryBuilder.generateSql(TestUser, complexOptions);

      // Should get same result from cache
      expect(result2.query).toBe(result1.query);
      expect(result2.parameters).toEqual(result1.parameters);

      // Verify cache hit
      const metrics = queryBuilder.getCacheMetrics();
      expect(metrics.hits).toBeGreaterThan(0);
    });

    test('should allow CTE name override via options.from (dialect usage)', () => {
      const options = { select: ['*'], where: [] } as const;
      const exprDialect: SqlDialect = {
        buildSelect: () => ({
          query: `WITH sales AS (SELECT * FROM orders) SELECT * FROM sales`,
          parameters: []
        })
      };
      const local = new QueryBuilder(exprDialect, mockLogger, 'test', enhancedCache);
      const res = local.generateSql(TestUser, options as any);
      expect(res.query).toContain('WITH sales AS (SELECT * FROM orders) SELECT * FROM sales');
    });

    test('should render JSON helpers in select list (dialect responsibility)', () => {
      const options = {
        select: [
          sql.jsonExtract('data', '$.user.name').as('u_name'),
          sql.jsonContains('tags', 'admin').as('has_admin')
        ],
        where: [] as any[]
      };
      const jsonDialect: SqlDialect = {
        buildSelect: (_ctor, opts) => ({
          query: `SELECT ${opts.select!.join(', ')} FROM test_users`,
          parameters: opts.selectParams ?? []
        })
      };
      const local = new QueryBuilder(jsonDialect, mockLogger, 'test', enhancedCache);
      const res = local.generateSql(TestUser, options as any);
      expect(res.query).toContain('JSON_EXTRACT(data, ?) AS u_name');
      expect(res.query).toContain('JSON_CONTAINS(tags, ?) AS has_admin');
      expect(res.parameters).toEqual(['$.user.name', 'admin']);
    });

    test('should render basic full-text search expressions', () => {
      const options = {
        select: [
          sql.mysqlMatchAgainst(['title', 'content'], 'node js', 'boolean').as('mscore'),
          sql
            .pgRank(
              sql.pgToTsVector(['title', 'content']).toString(),
              sql.pgWebsearchToTsQuery('node js').toString()
            )
            .as('pscore')
        ],
        where: [] as any[]
      };
      const ftsDialect: SqlDialect = {
        buildSelect: (_ctor, opts) => ({
          query: `SELECT ${opts.select!.join(', ')} FROM test_users`,
          parameters: opts.selectParams ?? []
        })
      };
      const local = new QueryBuilder(ftsDialect, mockLogger, 'test', enhancedCache);
      const res = local.generateSql(TestUser, options as any);
      expect(res.query).toContain('MATCH(title, content) AGAINST (? IN BOOLEAN MODE)');
      expect(res.query).toContain(
        "ts_rank(to_tsvector(?, COALESCE(title, '') || ' ' || COALESCE(content, '')), websearch_to_tsquery(?, ?)) AS pscore"
      );
      // At this layer we only collect parameters from top-level select expressions.
      // Since pgRank() receives stringified inner expressions, only MySQL match contributes a param.
      expect(res.parameters).toEqual(['node js']);
    });

    test('mysql: JSON and MATCH should be parameterized', () => {
      const options = {
        select: [
          sql.jsonExtract('payload', '$.a.b').as('val'),
          sql.mysqlMatchAgainst(['title', 'body'], 'golang', 'boolean').as('score')
        ],
        where: [] as any[]
      };
      // Use a MySQL-like stub dialect that respects selectParams
      const mysqlLikeDialect: SqlDialect = {
        buildSelect: (_ctor, opts) => ({
          query: `SELECT ${opts.select!.join(', ')} FROM test_users`,
          parameters: opts.selectParams ?? []
        })
      };
      const local = new QueryBuilder(mysqlLikeDialect, mockLogger, 'mysql', enhancedCache);
      const res = local.generateSql(TestUser as any, options as any);
      expect(res.query).toContain('JSON_EXTRACT(payload, ?) AS val');
      expect(res.query).toContain('MATCH(title, body) AGAINST (? IN BOOLEAN MODE) AS score');
      expect(res.parameters).toEqual(['$.a.b', 'golang']);
    });

    test('should expire cached queries after TTL', async () => {
      const shortTtlCache = new EnhancedSqlCache({
        defaultTtl: 50, // 50ms TTL
        enableMetrics: true
      });

      // Create a mock dialect for testing
      const mockDialect: SqlDialect = {
        buildSelect: () => ({
          query: 'SELECT * FROM test_users',
          parameters: []
        })
      };

      const shortTtlBuilder = new QueryBuilder(
        mockDialect,
        mockLogger,
        'test-provider',
        shortTtlCache
      );

      const options = { select: ['*'], where: [] };

      // Generate query and cache it
      const result1 = shortTtlBuilder.generateSql(TestUser, options);

      // Should hit cache immediately
      const result2 = shortTtlBuilder.generateSql(TestUser, options);
      expect(result2.query).toBe(result1.query);

      // Wait for TTL expiration
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Should miss cache after expiration
      (mockLogger.cache as jest.Mock).mockClear();
      const result3 = shortTtlBuilder.generateSql(TestUser, options);

      expect(mockLogger.cache as jest.Mock).toHaveBeenCalledWith({
        cache: 'sqlGen',
        hit: false,
        provider: 'test-provider'
      });
    });

    test('should handle cache eviction when max size exceeded', () => {
      const smallCache = new EnhancedSqlCache({
        maxSize: 2, // Very small cache
        enableMetrics: true,
        enableLru: true
      });

      // Create a mock dialect for testing
      const mockDialect: SqlDialect = {
        buildSelect: () => ({
          query: 'SELECT * FROM test_users',
          parameters: []
        })
      };

      const smallCacheBuilder = new QueryBuilder(
        mockDialect,
        mockLogger,
        'test-provider',
        smallCache
      );

      // Fill cache beyond capacity
      const options1 = { select: ['id'], where: [] };
      const options2 = { select: ['name'], where: [] };
      const options3 = { select: ['email'], where: [] };

      smallCacheBuilder.generateSql(TestUser, options1);
      smallCacheBuilder.generateSql(TestUser, options2);

      // Access options1 to make it recently used
      smallCacheBuilder.generateSql(TestUser, options1);

      // This should evict options2 (least recently used)
      smallCacheBuilder.generateSql(TestUser, options3);

      const metrics = smallCacheBuilder.getCacheMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
      expect(metrics.currentSize).toBeLessThanOrEqual(2);
    });
  });

  describe('Default Enhanced Cache', () => {
    test('should use enhanced cache by default when no external cache provided', () => {
      // Create a mock dialect for testing
      const mockDialect: SqlDialect = {
        buildSelect: () => ({
          query: 'SELECT * FROM test_users',
          parameters: []
        })
      };

      const builderWithoutCache = new QueryBuilder(mockDialect, mockLogger, 'test-provider');

      const options = { select: ['*'], where: [] };

      // Should work with default enhanced cache
      const result1 = builderWithoutCache.generateSql(TestUser, options);
      const result2 = builderWithoutCache.generateSql(TestUser, options);

      expect(result2.query).toBe(result1.query);

      // Enhanced cache should track metrics by default
      const metrics = builderWithoutCache.getCacheMetrics();
      expect(metrics.currentSize).toBeGreaterThanOrEqual(1);
      expect(metrics.totalRequests).toBe(2); // Enhanced cache tracks requests
      expect(metrics.hits).toBe(1); // Second request should be a hit
      expect(metrics.misses).toBe(1); // First request should be a miss
    });
  });

  describe('Cache Performance Monitoring', () => {
    test('should provide detailed cache statistics', () => {
      const options = { select: ['*'], where: [] };

      // Generate cache activity
      for (let i = 0; i < 20; i++) {
        queryBuilder.generateSql(TestUser, options);
      }

      const metrics = queryBuilder.getCacheMetrics();
      expect(metrics.totalRequests).toBe(20);
      expect(metrics.hits).toBe(19); // First miss, then 19 hits
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRatio).toBeCloseTo(19 / 20, 2);
      expect(metrics.averageAccessCount).toBe(20);
      expect(metrics.estimatedMemoryUsage).toBeGreaterThan(0);
    });

    test('should identify cache optimization opportunities', () => {
      // Create scenario with poor cache performance
      const highEvictionCache = new EnhancedSqlCache({
        maxSize: 5,
        enableMetrics: true
      });

      // Create a mock dialect for testing
      const mockDialect: SqlDialect = {
        buildSelect: () => ({
          query: 'SELECT * FROM test_users',
          parameters: []
        })
      };

      const testBuilder = new QueryBuilder(mockDialect, undefined, 'test', highEvictionCache);

      // Generate many different queries to cause evictions
      for (let i = 0; i < 20; i++) {
        const options = { select: [`col_${i}`], where: [] };
        testBuilder.generateSql(TestUser, options);
      }

      const insights = testBuilder.getOptimizationInsights();
      expect(insights.shouldIncreaseSize).toBe(true); // Should recommend larger cache
    });
  });
});
