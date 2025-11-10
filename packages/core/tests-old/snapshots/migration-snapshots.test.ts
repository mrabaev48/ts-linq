import { MigrationBuilder } from '../../src/migrations/MigrationBuilder';
import { PostgresDialect } from '../../../provider-postgres/src/PostgresDialect';
import { MySqlDialect } from '../../../provider-mysql/src/MySqlDialect';
import { MsSqlDialect } from '../../../provider-mssql/src/MsSqlDialect';

describe('DDL Migration Snapshots', () => {
  describe('CREATE TABLE Snapshots', () => {
    it('PostgreSQL - CREATE TABLE with constraints', () => {
      const dialect = new PostgresDialect();
      const builder = new MigrationBuilder(dialect);
      
      builder.createTable('users', (table) => {
        table.column('id').serial().primaryKey();
        table.column('email').varchar(255).notNull().unique();
        table.column('age').integer().nullable();
        table.column('created_at').timestamp().default('CURRENT_TIMESTAMP');
      });
      
      const sql = builder.toSQL();
      expect(sql).toMatchSnapshot();
    });

    it('MySQL - CREATE TABLE with indexes', () => {
      const dialect = new MySqlDialect();
      const builder = new MigrationBuilder(dialect);
      
      builder.createTable('products', (table) => {
        table.column('id').autoIncrement().primaryKey();
        table.column('name').varchar(200).notNull();
        table.column('price').decimal(10, 2).notNull();
        table.index(['name']);
        table.index(['price'], { unique: true });
      });
      
      const sql = builder.toSQL();
      expect(sql).toMatchSnapshot();
    });

    it('MSSQL - CREATE TABLE with foreign keys', () => {
      const dialect = new MsSqlDialect();
      const builder = new MigrationBuilder(dialect);
      
      builder.createTable('orders', (table) => {
        table.column('id').identity().primaryKey();
        table.column('user_id').integer().notNull();
        table.column('total').money().notNull();
        table.foreignKey('user_id').references('users', 'id').onDelete('CASCADE');
      });
      
      const sql = builder.toSQL();
      expect(sql).toMatchSnapshot();
    });
  });

  describe('ALTER TABLE Snapshots', () => {
    it('should generate ADD COLUMN snapshot', () => {
      const dialect = new PostgresDialect();
      const builder = new MigrationBuilder(dialect);
      
      builder.alterTable('users', (table) => {
        table.addColumn('phone').varchar(20).nullable();
      });
      
      const sql = builder.toSQL();
      expect(sql).toMatchSnapshot();
    });

    it('should generate DROP COLUMN snapshot', () => {
      const dialect = new PostgresDialect();
      const builder = new MigrationBuilder(dialect);
      
      builder.alterTable('users', (table) => {
        table.dropColumn('phone');
      });
      
      const sql = builder.toSQL();
      expect(sql).toMatchSnapshot();
    });

    it('should generate RENAME COLUMN snapshot', () => {
      const dialect = new PostgresDialect();
      const builder = new MigrationBuilder(dialect);
      
      builder.alterTable('users', (table) => {
        table.renameColumn('email', 'email_address');
      });
      
      const sql = builder.toSQL();
      expect(sql).toMatchSnapshot();
    });
  });

  describe('INDEX Snapshots', () => {
    it('should generate CREATE INDEX snapshot', () => {
      const dialect = new PostgresDialect();
      const builder = new MigrationBuilder(dialect);
      
      builder.createIndex('users', ['email', 'status'], {
        unique: true,
        where: 'status = \'active\''
      });
      
      const sql = builder.toSQL();
      expect(sql).toMatchSnapshot();
    });

    it('should generate DROP INDEX snapshot', () => {
      const dialect = new PostgresDialect();
      const builder = new MigrationBuilder(dialect);
      
      builder.dropIndex('users', 'idx_users_email_status');
      
      const sql = builder.toSQL();
      expect(sql).toMatchSnapshot();
    });
  });
});
