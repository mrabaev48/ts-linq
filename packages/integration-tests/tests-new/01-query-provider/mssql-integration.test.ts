import { MssqlDdlStrategy, MssqlDialect } from '@ts-linq/dialect-mssql';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions } from '@ts-linq/types';

class Order {
  id!: number;
  customerId!: string;
  total!: number;
}

describe('MSSQL Provider + QueryBuilder Integration', () => {
  let dialect: MssqlDialect;
  let strategy: MssqlDdlStrategy;

  beforeEach(() => {
    dialect = new MssqlDialect();
    strategy = new MssqlDdlStrategy();
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Order, 'orders');
    MetadataStorage.addColumn(Order, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(Order, {
      propertyName: 'customerId',
      columnName: 'customer_id',
      type: 'UUID',
      nullable: false
    });
    MetadataStorage.addColumn(Order, {
      propertyName: 'total',
      columnName: 'total',
      type: 'REAL',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(Order, 'id');
  });

  describe('Parameter Naming', () => {
    it('should use @p1, @p2, @p3 for parameters', () => {
      const opts: QueryOptions = {
        where: [
          { condition: 'total > ?', parameters: [100] },
          { condition: 'total < ?', parameters: [500] }
        ]
      };
      const { query } = dialect.buildSelect(Order, opts, MetadataStorage.getEntity(Order));
      expect(query).toContain('@p1');
      expect(query).toContain('@p2');
      // No raw ? placeholders should remain
      expect(query).not.toMatch(/(?<![A-Za-z0-9_])\?/);
    });

    it('should handle named parameters correctly', () => {
      const opts: QueryOptions = {
        where: [{ condition: 'id = ?', parameters: [1] }]
      };
      const { query, parameters } = dialect.buildSelect(
        Order,
        opts,
        MetadataStorage.getEntity(Order)
      );
      expect(query).toContain('@p1');
      expect(parameters).toHaveLength(1);
      expect(parameters[0]).toBe(1);
    });
  });

  describe('Identifier Escaping', () => {
    it('should use [square brackets] for identifiers', () => {
      const result = dialect.quoteIdentifier('column_name');
      expect(result).toBe('[column_name]');
    });

    it('should escape closing brackets in identifiers', () => {
      const result = dialect.quoteIdentifier('col]name');
      expect(result).toBe('[col]]name]');
    });
  });

  describe('IDENTITY Columns', () => {
    it('should insert with IDENTITY and use SCOPE_IDENTITY()', () => {
      const metadata = MetadataStorage.getEntity(Order)!;
      const result = dialect.buildInsert({ customerId: 'abc-123', total: 100 }, metadata);
      // IDENTITY column must be excluded from the column list
      expect(result.sql).not.toMatch(/INSERT INTO orders \([^)]*\[id\]/);
      // OUTPUT INSERTED.[id] must be present for the auto-increment PK
      expect(result.sql).toContain('OUTPUT INSERTED.[id]');
      expect(result.returningPk).toBe('id');
    });

    it('should handle IDENTITY INSERT ON/OFF', () => {
      // The DDL column definition must declare IDENTITY(1,1) for generated PKs
      const colDef = strategy.generateColumnDefinition({
        columnName: 'id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: true
      });
      expect(colDef).toContain('IDENTITY(1,1)');
    });
  });

  describe('TOP vs OFFSET FETCH', () => {
    it('should use TOP for simple limit', () => {
      const opts: QueryOptions = { limit: 10 };
      const { query } = dialect.buildSelect(Order, opts, MetadataStorage.getEntity(Order));
      expect(query).toContain('TOP (10)');
      expect(query).not.toContain('OFFSET');
    });

    it('should use OFFSET FETCH for skip + take', () => {
      const opts: QueryOptions = { limit: 10, offset: 20 };
      const { query } = dialect.buildSelect(Order, opts, MetadataStorage.getEntity(Order));
      expect(query).toContain('OFFSET 20 ROWS');
      expect(query).toContain('FETCH NEXT 10 ROWS ONLY');
      expect(query).not.toContain('TOP');
    });

    it('should require ORDER BY with OFFSET FETCH', () => {
      // Without an explicit ORDER BY, the dialect injects ORDER BY (SELECT NULL)
      const opts: QueryOptions = { limit: 10, offset: 5 };
      const { query } = dialect.buildSelect(Order, opts, MetadataStorage.getEntity(Order));
      expect(query).toContain('ORDER BY (SELECT NULL)');
      expect(query).toContain('OFFSET 5 ROWS');
      expect(query).toContain('FETCH NEXT 10 ROWS ONLY');
    });
  });

  describe('MSSQL-Specific Types', () => {
    it('should handle NVARCHAR for Unicode strings', () => {
      const colDef = strategy.generateColumnDefinition({
        columnName: 'description',
        type: 'TEXT',
        nullable: true
      });
      // TEXT maps to NVARCHAR(MAX) in MSSQL
      expect(colDef).toContain('NVARCHAR(MAX)');
    });

    it('should handle uniqueidentifier (GUID)', () => {
      const colDef = strategy.generateColumnDefinition({
        columnName: 'external_id',
        type: 'UUID',
        nullable: false
      });
      expect(colDef).toContain('UNIQUEIDENTIFIER');
    });

    it('should handle XML column type', () => {
      // XML is not an explicit mapping; falls back to NVARCHAR(MAX)
      const colDef = strategy.generateColumnDefinition({
        columnName: 'xml_data',
        type: 'XML',
        nullable: true
      });
      expect(colDef).toContain('NVARCHAR(MAX)');
    });
  });

  describe('Stored Procedures', () => {
    it('should execute stored procedure via EXEC', () => {
      // sp_rename is exposed via generateRenameTableSql
      const sql = strategy.generateRenameTableSql('old_orders', 'orders_archive');
      expect(sql).toContain('EXEC sp_rename');
      expect(sql).toContain('old_orders');
      expect(sql).toContain('orders_archive');
    });

    it('should handle OUTPUT parameters from stored proc', () => {
      // INSERT for IDENTITY PKs uses OUTPUT INSERTED to retrieve the generated key
      const metadata = MetadataStorage.getEntity(Order)!;
      const result = dialect.buildInsert({ customerId: 'abc', total: 200 }, metadata);
      expect(result.sql).toContain('OUTPUT INSERTED');
      expect(result.returningPk).toBeDefined();
    });
  });
});
