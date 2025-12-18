import { MigrationBuilder } from '../src/MigrationBuilder';

describe('MigrationBuilder', () => {
  describe('createTable()', () => {
    it('should create a table with columns and generate correct diff', () => {
      const builder = new MigrationBuilder();
      
      builder.createTable('users', t => {
        t.column('id', 'INTEGER', { nullable: false });
        t.column('name', 'TEXT');
        t.column('email', 'TEXT', { nullable: false });
        t.primaryKey('id');
      });
      
      const diff = builder.toDiff();
      expect(diff.tables).toHaveLength(1);
      expect(diff.tables[0].table).toBe('users');
      expect(diff.tables[0].create).toBeDefined();
      expect(diff.tables[0].create!.columns).toHaveLength(3);
      expect(diff.tables[0].create!.columns[0].name).toBe('id');
      expect(diff.tables[0].create!.primaryKeys).toContain('id');
    });

    it('should support default values in diff', () => {
      const builder = new MigrationBuilder();
      
      builder.createTable('settings', t => {
        t.column('id', 'INTEGER');
        t.column('enabled', 'BOOLEAN', { defaultValue: true });
        t.column('count', 'INTEGER', { defaultValue: 0 });
      });
      
      const diff = builder.toDiff();
      const cols = diff.tables[0].create!.columns;
      expect(cols.find(c => c.name === 'enabled')?.defaultValue).toBe(true);
      expect(cols.find(c => c.name === 'count')?.defaultValue).toBe(0);
    });

    it('should support indexes in diff', () => {
      const builder = new MigrationBuilder();
      
      builder.createTable('products', t => {
        t.column('id', 'INTEGER');
        t.column('sku', 'TEXT');
        t.index('idx_sku', ['sku'], true);
      });
      
      const diff = builder.toDiff();
      expect(diff.tables[0].create!.indexes).toHaveLength(1);
      expect(diff.tables[0].create!.indexes[0].name).toBe('idx_sku');
      expect(diff.tables[0].create!.indexes[0].unique).toBe(true);
    });

    it('should support foreign keys in diff', () => {
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
      
      const diff = builder.toDiff();
      expect(diff.tables[0].create!.foreignKeys).toHaveLength(1);
      expect(diff.tables[0].create!.foreignKeys[0].refTable).toBe('users');
      expect(diff.tables[0].create!.foreignKeys[0].onDelete).toBe('CASCADE');
    });
  });

  describe('dropTable()', () => {
    it('should register table for dropping in diff', () => {
      const builder = new MigrationBuilder();
      builder.dropTable('old_table');
      
      const diff = builder.toDiff();
      expect(diff.tables).toHaveLength(1);
      expect(diff.tables[0].table).toBe('old_table');
      expect(diff.tables[0].drop).toBe(true);
    });

    it('should support dropping multiple tables', () => {
      const builder = new MigrationBuilder();
      builder.dropTable('table1');
      builder.dropTable('table2');
      
      const diff = builder.toDiff();
      expect(diff.tables).toHaveLength(2);
      expect(diff.tables.every(t => t.drop)).toBe(true);
    });
  });

  describe('alterTable()', () => {
    it('should add column to existing table in diff', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.addColumn('age', 'INTEGER', { nullable: true });
      });
      
      const diff = builder.toDiff();
      const usersTable = diff.tables.find(t => t.table === 'users');
      expect(usersTable).toBeDefined();
      expect(usersTable!.columnChanges).toBeDefined();
      expect(usersTable!.columnChanges!.some(c => c.kind === 'add' && c.column.name === 'age')).toBe(true);
    });

    it('should add multiple columns in diff', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.addColumn('first_name', 'TEXT');
        t.addColumn('last_name', 'TEXT');
      });
      
      const diff = builder.toDiff();
      const usersTable = diff.tables.find(t => t.table === 'users');
      expect(usersTable!.columnChanges).toHaveLength(2);
    });

    it('should drop column from table in diff', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.dropColumn('deprecated_field');
      });
      
      const diff = builder.toDiff();
      const usersTable = diff.tables.find(t => t.table === 'users');
      expect(usersTable!.columnChanges!.some(c => c.kind === 'drop' && c.column.name === 'deprecated_field')).toBe(true);
    });

    it('should alter column type in diff', () => {
      const builder = new MigrationBuilder();
      builder.alterTable('users', t => {
        t.alterColumn('age', 'BIGINT');
      });
      
      const diff = builder.toDiff();
      const usersTable = diff.tables.find(t => t.table === 'users');
      expect(usersTable!.columnChanges!.some(c => c.kind === 'alter' && c.column.name === 'age')).toBe(true);
    });
  });

  describe('createIndex()', () => {
    it('should create index in diff', () => {
      const builder = new MigrationBuilder();
      builder.createIndex('users', 'idx_email', ['email']);
      
      const diff = builder.toDiff();
      const usersTable = diff.tables.find(t => t.table === 'users');
      expect(usersTable!.indexCreates).toBeDefined();
      expect(usersTable!.indexCreates!.some(i => i.name === 'idx_email')).toBe(true);
    });

    it('should create unique index in diff', () => {
      const builder = new MigrationBuilder();
      builder.createIndex('users', 'idx_unique_email', ['email'], true);
      
      const diff = builder.toDiff();
      const usersTable = diff.tables.find(t => t.table === 'users');
      const addedIndex = usersTable!.indexCreates!.find(i => i.name === 'idx_unique_email');
      expect(addedIndex!.unique).toBe(true);
    });

    it('should create composite index in diff', () => {
      const builder = new MigrationBuilder();
      builder.createIndex('orders', 'idx_user_date', ['user_id', 'order_date']);
      
      const diff = builder.toDiff();
      const ordersTable = diff.tables.find(t => t.table === 'orders');
      const addedIndex = ordersTable!.indexCreates!.find(i => i.name === 'idx_user_date');
      expect(addedIndex!.columns).toEqual(['user_id', 'order_date']);
    });
  });

  describe('dropIndex()', () => {
    it('should drop index in diff', () => {
      const builder = new MigrationBuilder();
      builder.dropIndex('users', 'idx_old');
      
      const diff = builder.toDiff();
      const usersTable = diff.tables.find(t => t.table === 'users');
      expect(usersTable!.indexDrops).toContain('idx_old');
    });
  });

  describe('renameTable()', () => {
    it('should rename table in diff', () => {
      const builder = new MigrationBuilder();
      builder.renameTable('old_name', 'new_name');
      
      const diff = builder.toDiff();
      const renamedTable = diff.tables.find(t => t.table === 'old_name');
      expect(renamedTable!.renameTo).toBe('new_name');
    });
  });

  describe('renameColumn()', () => {
    it('should rename column in diff', () => {
      const builder = new MigrationBuilder();
      builder.renameColumn('users', 'old_col', 'new_col');
      
      const diff = builder.toDiff();
      const usersTable = diff.tables.find(t => t.table === 'users');
      expect(usersTable!.columnRenames!.some(c => c.from === 'old_col')).toBe(true);
    });
  });

  describe('addForeignKey()', () => {
    it('should add foreign key in diff', () => {
      const builder = new MigrationBuilder();
      builder.addForeignKey('orders', {
        columns: ['customer_id'],
        refTable: 'customers',
        refColumns: ['id']
      });
      
      const diff = builder.toDiff();
      const ordersTable = diff.tables.find(t => t.table === 'orders');
      expect(ordersTable!.fkCreates).toBeDefined();
      expect(ordersTable!.fkCreates!.some(fk => fk.refTable === 'customers')).toBe(true);
    });

    it('should add foreign key with cascade options in diff', () => {
      const builder = new MigrationBuilder();
      builder.addForeignKey('line_items', {
        name: 'fk_order',
        columns: ['order_id'],
        refTable: 'orders',
        refColumns: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      
      const diff = builder.toDiff();
      const lineItemsTable = diff.tables.find(t => t.table === 'line_items');
      const addedFk = lineItemsTable!.fkCreates!.find(fk => fk.name === 'fk_order');
      expect(addedFk!.onDelete).toBe('CASCADE');
      expect(addedFk!.onUpdate).toBe('CASCADE');
    });
  });

  describe('dropForeignKey()', () => {
    it('should drop foreign key in diff', () => {
      const builder = new MigrationBuilder();
      builder.dropForeignKey('orders', 'fk_customer');
      
      const diff = builder.toDiff();
      const ordersTable = diff.tables.find(t => t.table === 'orders');
      expect(ordersTable!.fkDrops).toContain('fk_customer');
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
