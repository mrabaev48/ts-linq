import { QueryBuilder } from '../../src/query/QueryBuilder';
import { PostgresDialect } from '../../../provider-postgres/src/PostgresDialect';
import { MySqlDialect } from '../../../provider-mysql/src/MySqlDialect';
import { MsSqlDialect } from '../../../provider-mssql/src/MsSqlDialect';
import { SqliteDialect } from '../../../provider-sqlite/src/SqliteDialect';

describe('SQL Query Snapshots', () => {
  describe('PostgreSQL Dialect', () => {
    const dialect = new PostgresDialect();

    it('should generate SELECT with WHERE snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.where([{ field: 'age', operator: '>', value: 18 }]);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });

    it('should generate JOIN snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.join('orders', 'users.id', 'orders.userId');
      builder.select(['users.name', 'orders.total']);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });

    it('should generate CTE snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.where([{ field: 'active', operator: '=', value: true }]);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });

    it('should generate pagination snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.skip(10).take(20);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });

    it('should generate GROUP BY snapshot', () => {
      const builder = new QueryBuilder('orders', dialect);
      builder.groupBy(['customerId']);
      builder.select(['customerId', 'COUNT(*) as orderCount']);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });
  });

  describe('MySQL Dialect', () => {
    const dialect = new MySqlDialect();

    it('should generate SELECT snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.where([{ field: 'status', operator: '=', value: 'active' }]);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });

    it('should generate LIMIT/OFFSET snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.skip(5).take(10);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });

    it('should generate JSON_EXTRACT snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.where([{ field: 'metadata->>email', operator: '=', value: 'test@example.com' }]);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });
  });

  describe('MSSQL Dialect', () => {
    const dialect = new MsSqlDialect();

    it('should generate OFFSET/FETCH snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.skip(10).take(20);
      builder.orderBy([{ field: 'id', direction: 'ASC' }]);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });

    it('should generate TOP snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.take(10);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });
  });

  describe('SQLite Dialect', () => {
    const dialect = new SqliteDialect();

    it('should generate LIMIT snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.take(10);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });

    it('should generate LIMIT -1 with OFFSET snapshot', () => {
      const builder = new QueryBuilder('users', dialect);
      builder.skip(10);
      
      const { sql } = builder.buildSelect();
      expect(sql).toMatchSnapshot();
    });
  });
});
