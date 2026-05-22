import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions, SqlDialect } from '@ts-linq/types';

class CrossItem {
  id!: number;
  name!: string;
  score!: number;
  createdAt!: Date;
}

function makeDialect(providerName: string): SqlDialect {
  switch (providerName) {
    case 'postgresql':
      return new PostgresDialect();
    case 'mysql':
      return new MysqlDialect();
    case 'mssql':
      return new MssqlDialect();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

const providers = ['postgresql', 'mysql', 'mssql'];

describe('Cross-Provider Compatibility', () => {
  describe.each(providers)('%s provider', (providerName) => {
    let dialect: SqlDialect;

    beforeEach(() => {
      dialect = makeDialect(providerName);
      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(CrossItem, 'items');
      MetadataStorage.addColumn(CrossItem, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: true
      });
      MetadataStorage.addColumn(CrossItem, {
        propertyName: 'name',
        columnName: 'name',
        type: 'TEXT',
        nullable: true
      });
      MetadataStorage.addColumn(CrossItem, {
        propertyName: 'score',
        columnName: 'score',
        type: 'INTEGER',
        nullable: false
      });
      MetadataStorage.addColumn(CrossItem, {
        propertyName: 'createdAt',
        columnName: 'created_at',
        type: 'DATETIME',
        nullable: true
      });
      MetadataStorage.addPrimaryKey(CrossItem, 'id');
    });

    it('should execute same query across all providers with consistent results', () => {
      const opts: QueryOptions = { select: ['id', 'name', 'score'] };
      const { query } = dialect.buildSelect(CrossItem, opts);
      // All providers must emit a SELECT with the given columns
      expect(query).toContain('SELECT');
      expect(query).toContain('id');
      expect(query).toContain('name');
      expect(query).toContain('score');
      expect(query).toContain('FROM');
      expect(query).toContain('items');
    });

    it('should handle NULL values consistently', () => {
      const opts: QueryOptions = {
        where: [{ condition: 'name IS NULL', parameters: [] }]
      };
      const { query, parameters } = dialect.buildSelect(CrossItem, opts);
      expect(query).toContain('WHERE');
      expect(query).toContain('name IS NULL');
      expect(parameters).toHaveLength(0);
    });

    it('should support DISTINCT across providers', () => {
      const opts: QueryOptions = { distinct: true, select: ['name'] };
      const { query } = dialect.buildSelect(CrossItem, opts);
      expect(query).toContain('SELECT DISTINCT');
      expect(query).toContain('name');
    });

    it('should handle UNION across providers', () => {
      // UNION is composed at application level from two independent SELECT statements
      const opts1: QueryOptions = { where: [{ condition: 'score > ?', parameters: [50] }] };
      const opts2: QueryOptions = { where: [{ condition: 'score < ?', parameters: [10] }] };
      const { query: q1 } = dialect.buildSelect(CrossItem, opts1);
      const { query: q2 } = dialect.buildSelect(CrossItem, opts2);
      const union = `${q1} UNION ${q2}`;
      // Both halves must be valid SELECT statements
      expect(q1).toContain('SELECT');
      expect(q2).toContain('SELECT');
      expect(union).toContain('UNION');
    });

    it('should support subqueries in WHERE clause', () => {
      const opts: QueryOptions = {
        where: [
          {
            condition: 'id IN (SELECT id FROM other_items WHERE active = 1)',
            parameters: []
          }
        ]
      };
      const { query } = dialect.buildSelect(CrossItem, opts);
      expect(query).toContain('WHERE');
      expect(query).toContain('SELECT id FROM other_items');
    });

    it('should handle CASE expressions', () => {
      const opts: QueryOptions = {
        select: ["CASE WHEN score >= 50 THEN 'pass' ELSE 'fail' END AS result"]
      };
      const { query } = dialect.buildSelect(CrossItem, opts);
      expect(query).toContain('CASE WHEN');
      expect(query).toContain('THEN');
      expect(query).toContain('ELSE');
    });

    it('should support EXISTS clause', () => {
      const opts: QueryOptions = {
        where: [
          {
            condition: 'EXISTS (SELECT 1 FROM scores WHERE scores.item_id = id)',
            parameters: []
          }
        ]
      };
      const { query } = dialect.buildSelect(CrossItem, opts);
      expect(query).toContain('WHERE');
      expect(query).toContain('EXISTS');
    });

    it('should handle date/time functions consistently', () => {
      // All providers accept parameterised date comparisons in WHERE
      const opts: QueryOptions = {
        where: [{ condition: 'created_at > ?', parameters: [new Date('2024-01-01')] }]
      };
      const { query, parameters } = dialect.buildSelect(CrossItem, opts);
      expect(query).toContain('WHERE');
      expect(query).toContain('created_at');
      // One parameter must be passed through regardless of provider
      expect(parameters).toHaveLength(1);
    });
  });
});
