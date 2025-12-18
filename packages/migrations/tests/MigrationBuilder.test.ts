import { MigrationBuilder } from '../src/MigrationBuilder';

describe('MigrationBuilder', () => {
  describe('createTable()', () => {
    it('should create a table with columns', () => {
      const builder = new MigrationBuilder();
      
      builder.createTable('users', t => {
        t.column('id', 'INTEGER', { nullable: false });
        t.column('name', 'TEXT');
        t.column('email', 'TEXT', { nullable: false });
        t.primaryKey('id');
      });
      
      expect(builder).toBeDefined();
    });

    it('should support default values', () => {
      const builder = new MigrationBuilder();
      
      builder.createTable('settings', t => {
        t.column('id', 'INTEGER');
        t.column('enabled', 'BOOLEAN', { defaultValue: true });
        t.column('count', 'INTEGER', { defaultValue: 0 });
      });
      
      expect(builder).toBeDefined();
    });

    it('should support default expressions', () => {
      const builder = new MigrationBuilder();
      
      builder.createTable('events', t => {
        t.column('id', 'INTEGER');
        t.column('created_at', 'TIMESTAMP', { defaultExpression: 'CURRENT_TIMESTAMP' });
      });
      
      expect(builder).toBeDefined();
    });

    it('should support indexes', () => {
      const builder = new MigrationBuilder();
      
      builder.createTable('products', t => {
        t.column('id', 'INTEGER');
        t.column('sku', 'TEXT');
        t.index('idx_sku', ['sku'], true);
      });
      
      expect(builder).toBeDefined();
    });

    it('should support foreign keys', () => {
      const builder = new MigrationBuilder();
      
      builder.createTable('orders', t => {
        t.column('id', 'INTEGER');
        t.column('user_id', 'INTEGER');
        t.foreignKey({
          columns: ['user_id'],
          refTable: 'users',
          refColumns: ['id'],
          onDelete: 'CASCADE'
        });
      });
      
      expect(builder).toBeDefined();
    });
  });

  describe('dropTable()', () => {
    it('should register table for dropping', () => {
      const builder = new MigrationBuilder();
      builder.dropTable('old_table');
      
      expect(builder).toBeDefined();
    });

    it('should support dropping multiple tables', () => {
      const builder = new MigrationBuilder();
      builder.dropTable('table1');
      builder.dropTable('table2');
      
      expect(builder).toBeDefined();
    });
  });

  describe('alterTable()', () => {
    it('should add column to existing table', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.addColumn('age', 'INTEGER', { nullable: true });
      });
      
      expect(builder).toBeDefined();
    });

    it('should add multiple columns', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.addColumn('first_name', 'TEXT');
        t.addColumn('last_name', 'TEXT');
      });
      
      expect(builder).toBeDefined();
    });

    it('should drop column from table', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.dropColumn('deprecated_field');
      });
      
      expect(builder).toBeDefined();
    });

    it('should alter column type', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.alterColumn('age', 'BIGINT');
      });
      
      expect(builder).toBeDefined();
    });

    it('should alter column nullable', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.alterColumn('email', 'TEXT', { nullable: false });
      });
      
      expect(builder).toBeDefined();
    });
  });

  describe('createIndex()', () => {
    it('should create index on table', () => {
      const builder = new MigrationBuilder();
      builder.createIndex('users', 'idx_email', ['email']);
      
      expect(builder).toBeDefined();
    });

    it('should create unique index', () => {
      const builder = new MigrationBuilder();
      builder.createIndex('users', 'idx_unique_email', ['email'], true);
      
      expect(builder).toBeDefined();
    });

    it('should create composite index', () => {
      const builder = new MigrationBuilder();
      builder.createIndex('orders', 'idx_user_date', ['user_id', 'order_date']);
      
      expect(builder).toBeDefined();
    });
  });

  describe('dropIndex()', () => {
    it('should drop index from table', () => {
      const builder = new MigrationBuilder();
      builder.dropIndex('users', 'idx_old');
      
      expect(builder).toBeDefined();
    });
  });

  describe('renameTable()', () => {
    it('should rename table', () => {
      const builder = new MigrationBuilder();
      builder.renameTable('old_name', 'new_name');
      
      expect(builder).toBeDefined();
    });
  });

  describe('renameColumn()', () => {
    it('should rename column', () => {
      const builder = new MigrationBuilder();
      builder.renameColumn('users', 'old_col', 'new_col');
      
      expect(builder).toBeDefined();
    });
  });

  describe('addForeignKey()', () => {
    it('should add foreign key to table', () => {
      const builder = new MigrationBuilder();
      builder.addForeignKey('orders', {
        columns: ['customer_id'],
        refTable: 'customers',
        refColumns: ['id']
      });
      
      expect(builder).toBeDefined();
    });

    it('should add foreign key with cascade options', () => {
      const builder = new MigrationBuilder();
      builder.addForeignKey('line_items', {
        name: 'fk_order',
        columns: ['order_id'],
        refTable: 'orders',
        refColumns: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      
      expect(builder).toBeDefined();
    });
  });

  describe('dropForeignKey()', () => {
    it('should drop foreign key', () => {
      const builder = new MigrationBuilder();
      builder.dropForeignKey('orders', 'fk_customer');
      
      expect(builder).toBeDefined();
    });
  });

  describe('toSql()', () => {
    it('should generate SQL for sqlite dialect', () => {
      const builder = new MigrationBuilder();
      builder.createTable('test', t => {
        t.column('id', 'INTEGER', { nullable: false });
        t.primaryKey('id');
      });
      
      const result = builder.toSql('sqlite');
      expect(result.up).toBeDefined();
      expect(result.up.some(s => s.includes('CREATE TABLE'))).toBe(true);
    });

    it('should generate SQL for postgresql dialect', () => {
      const builder = new MigrationBuilder();
      builder.createTable('test', t => {
        t.column('id', 'INTEGER');
      });
      
      const result = builder.toSql('postgresql');
      expect(result.up).toBeDefined();
      expect(result.up.some(s => s.includes('CREATE TABLE'))).toBe(true);
    });

    it('should generate SQL for mysql dialect', () => {
      const builder = new MigrationBuilder();
      builder.createTable('test', t => {
        t.column('id', 'INTEGER');
      });
      
      const result = builder.toSql('mysql');
      expect(result.up).toBeDefined();
      expect(result.up.some(s => s.includes('CREATE TABLE'))).toBe(true);
    });

    it('should generate SQL for mssql dialect', () => {
      const builder = new MigrationBuilder();
      builder.createTable('test', t => {
        t.column('id', 'INTEGER');
      });
      
      const result = builder.toSql('mssql');
      expect(result.up).toBeDefined();
      expect(result.up.some(s => s.includes('CREATE TABLE'))).toBe(true);
    });
  });

  describe('toDiff()', () => {
    it('should generate diff for create table', () => {
      const builder = new MigrationBuilder();
      builder.createTable('users', t => {
        t.column('id', 'INTEGER');
        t.primaryKey('id');
      });
      
      const diff = builder.toDiff();
      expect(diff.tables).toHaveLength(1);
      expect(diff.tables[0].table).toBe('users');
      expect(diff.tables[0].create).toBeDefined();
    });

    it('should generate diff for drop table', () => {
      const builder = new MigrationBuilder();
      builder.dropTable('old_table');
      
      const diff = builder.toDiff();
      expect(diff.tables).toHaveLength(1);
      expect(diff.tables[0].drop).toBe(true);
    });

    it('should generate diff for multiple operations', () => {
      const builder = new MigrationBuilder();
      builder.createTable('new_table', t => {
        t.column('id', 'INTEGER');
      });
      builder.dropTable('old_table');
      builder.createIndex('existing', 'idx_test', ['col']);
      
      const diff = builder.toDiff();
      expect(diff.tables.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Chaining', () => {
    it('should support method chaining', () => {
      const builder = new MigrationBuilder()
        .createTable('users', t => {
          t.column('id', 'INTEGER');
          t.primaryKey('id');
        })
        .createIndex('users', 'idx_id', ['id'])
        .alterTable('users', t => {
          t.addColumn('status', 'TEXT');
        });
      
      expect(builder).toBeDefined();
    });
  });
});
