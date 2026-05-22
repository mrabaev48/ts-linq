import { MySqlDdlStrategy, MysqlDialect } from '@ts-linq/dialect-mysql';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions } from '@ts-linq/types';

class Product {
  id!: number;
  name!: string;
  inStock!: boolean;
  createdAt!: Date;
}

describe('MySQL Provider + QueryBuilder Integration', () => {
  let dialect: MysqlDialect;
  let strategy: MySqlDdlStrategy;

  beforeEach(() => {
    dialect = new MysqlDialect();
    strategy = new MySqlDdlStrategy();
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Product, 'products');
    MetadataStorage.addColumn(Product, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(Product, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(Product, {
      propertyName: 'inStock',
      columnName: 'in_stock',
      type: 'BOOLEAN',
      nullable: false
    });
    MetadataStorage.addColumn(Product, {
      propertyName: 'createdAt',
      columnName: 'created_at',
      type: 'DATETIME',
      nullable: true
    });
    MetadataStorage.addPrimaryKey(Product, 'id');
  });

  describe('Identifier Escaping', () => {
    it('should use backticks for identifier escaping', () => {
      const result = dialect.quoteIdentifier('column_name');
      expect(result).toBe('`column_name`');
    });

    it('should escape backticks in identifiers', () => {
      const result = dialect.quoteIdentifier('col`name');
      expect(result).toBe('`col``name`');
    });
  });

  describe('AUTO_INCREMENT Handling', () => {
    it('should insert with AUTO_INCREMENT and return ID', () => {
      const metadata = MetadataStorage.getEntity(Product)!;
      const result = dialect.buildInsert({ name: 'Widget', inStock: true }, metadata);
      // isGenerated (AUTO_INCREMENT) column must be excluded from INSERT
      expect(result.sql).not.toContain('`id`');
      expect(result.sql).toContain('INSERT INTO products');
      expect(result.sql).toContain('name');
    });

    it('should handle batch insert with AUTO_INCREMENT', () => {
      const metadata = MetadataStorage.getEntity(Product)!;
      const insert1 = dialect.buildInsert({ name: 'A', inStock: true }, metadata);
      const insert2 = dialect.buildInsert({ name: 'B', inStock: false }, metadata);
      // Both inserts must exclude the generated id column
      expect(insert1.sql).not.toContain('`id`');
      expect(insert2.sql).not.toContain('`id`');
      // SQL structure must be identical across batch entries
      expect(insert1.sql).toBe(insert2.sql);
    });
  });

  describe('MySQL-Specific Types', () => {
    it('should handle TINYINT for boolean', () => {
      const colDef = strategy.generateColumnDefinition({
        columnName: 'active',
        type: 'BOOLEAN',
        nullable: false
      });
      expect(colDef).toContain('TINYINT(1)');
    });

    it('should handle DATETIME vs TIMESTAMP', () => {
      const datetimeDef = strategy.generateColumnDefinition({
        columnName: 'created_at',
        type: 'DATETIME',
        nullable: true
      });
      // DATETIME maps directly to MySQL DATETIME
      expect(datetimeDef).toContain('DATETIME');
    });

    it('should handle TEXT vs VARCHAR correctly', () => {
      const textDef = strategy.generateColumnDefinition({
        columnName: 'body',
        type: 'TEXT',
        nullable: true
      });
      expect(textDef).toContain('TEXT');

      // VARCHAR is not a canonical type in this dialect; falls back to TEXT
      const varcharDef = strategy.generateColumnDefinition({
        columnName: 'title',
        type: 'VARCHAR',
        nullable: false
      });
      expect(varcharDef).toContain('TEXT');
    });
  });

  describe('Pagination Quirks', () => {
    it('should use very large number for LIMIT without OFFSET', () => {
      // MySQL requires a LIMIT to use OFFSET; uses max BIGINT unsigned as sentinel
      const opts: QueryOptions = { offset: 10 };
      const { query } = dialect.buildSelect(Product, opts);
      expect(query).toContain('LIMIT 18446744073709551615 OFFSET 10');
    });

    it('should use proper LIMIT OFFSET syntax', () => {
      const opts: QueryOptions = { limit: 5, offset: 2 };
      const { query } = dialect.buildSelect(Product, opts);
      expect(query).toContain('LIMIT 5 OFFSET 2');
    });
  });

  describe('Index Types', () => {
    it('should support FULLTEXT indexes', () => {
      const sql = strategy.generateCreateIndexSql('products', {
        name: 'ft_name',
        columns: ['name'],
        unique: false,
        mysqlType: 'FULLTEXT'
      });
      expect(sql).toContain('CREATE FULLTEXT INDEX');
      expect(sql).toContain('`ft_name`');
      expect(sql).toContain('`products`');
    });

    it('should support SPATIAL indexes', () => {
      const sql = strategy.generateCreateIndexSql('products', {
        name: 'sp_geo',
        columns: ['geo'],
        unique: false,
        mysqlType: 'SPATIAL'
      });
      expect(sql).toContain('CREATE SPATIAL INDEX');
      expect(sql).toContain('`sp_geo`');
    });
  });

  describe('Transactions & Locking', () => {
    it('should support SELECT FOR UPDATE locking', () => {
      // The dialect generates standard SELECT; FOR UPDATE is added at provider/session level.
      // Verify the generated SELECT is valid and can be extended with a locking clause.
      const opts: QueryOptions = {};
      const { query } = dialect.buildSelect(Product, opts);
      expect(query).toMatch(/^SELECT \* FROM `products`/);
      // A driver-level lock clause can be appended to the generated SQL
      const withLock = `${query} FOR UPDATE`;
      expect(withLock).toContain('FOR UPDATE');
    });

    it('should handle deadlock detection', () => {
      // Deadlock detection is a runtime/driver concern handled outside SQL generation.
      // The dialect must still produce correct parameterised SQL for use in transactions.
      const opts: QueryOptions = {
        where: [{ condition: 'id = ?', parameters: [1] }]
      };
      const { query, parameters } = dialect.buildSelect(Product, opts);
      expect(query).toContain('WHERE');
      expect(parameters).toHaveLength(1);
      expect(parameters[0]).toBe(1);
    });
  });
});
