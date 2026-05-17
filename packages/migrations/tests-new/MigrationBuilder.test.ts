import { beforeEach, describe, expect, it } from '@jest/globals';

import type { SchemaDiff, TableDiff } from '../src/DiffTypes';
import { MigrationBuilder } from '../src/MigrationBuilder';

// Helper functions for navigating SchemaDiff structure
function getTableCreate(diff: SchemaDiff, tableName: string) {
  return diff.tables.find((t) => t.table === tableName && t.create)?.create;
}

function getTableDrop(diff: SchemaDiff, tableName: string) {
  return diff.tables.find((t) => t.table === tableName && t.drop);
}

function getTableDiff(diff: SchemaDiff, tableName: string): TableDiff | undefined {
  return diff.tables.find((t) => t.table === tableName);
}

function getColumnChanges(diff: SchemaDiff, tableName: string, kind?: 'add' | 'alter' | 'drop') {
  const table = getTableDiff(diff, tableName);
  const changes = table?.columnChanges || [];
  return kind ? changes.filter((c) => c.kind === kind) : changes;
}

describe('MigrationBuilder', () => {
  let builder: MigrationBuilder;

  beforeEach(() => {
    builder = new MigrationBuilder();
  });

  describe('createTable()', () => {
    it('should create table with columns', () => {
      builder.createTable('users', (t) => {
        t.column('id', 'INTEGER', { nullable: false });
        t.column('name', 'VARCHAR', { nullable: false });
        t.column('email', 'VARCHAR');
      });

      const diff = builder.toDiff();
      const table = getTableCreate(diff, 'users');

      expect(table).toBeDefined();
      expect(table!.name).toBe('users');
      expect(table!.columns).toHaveLength(3);
      expect(table!.columns[0].name).toBe('id');
      expect(table!.columns[0].type).toBe('INTEGER');
    });

    it('should create table with primary key', () => {
      builder.createTable('users', (t) => {
        t.column('id', 'INTEGER');
        t.primaryKey('id');
      });

      const diff = builder.toDiff();
      const table = getTableCreate(diff, 'users');

      expect(table!.primaryKeys).toContain('id');
    });

    it('should create table with composite primary key', () => {
      builder.createTable('user_roles', (t) => {
        t.column('user_id', 'INTEGER');
        t.column('role_id', 'INTEGER');
        t.primaryKey('user_id', 'role_id');
      });

      const diff = builder.toDiff();
      const table = getTableCreate(diff, 'user_roles');

      expect(table!.primaryKeys).toEqual(['user_id', 'role_id']);
    });

    it('should create table with indexes', () => {
      builder.createTable('users', (t) => {
        t.column('id', 'INTEGER');
        t.column('email', 'VARCHAR');
        t.index('idx_email', ['email']);
      });

      const diff = builder.toDiff();
      const table = getTableCreate(diff, 'users');

      expect(table!.indexes).toHaveLength(1);
      expect(table!.indexes[0].name).toBe('idx_email');
      expect(table!.indexes[0].columns).toEqual(['email']);
    });

    it('should create table with unique index', () => {
      builder.createTable('users', (t) => {
        t.column('email', 'VARCHAR');
        t.index('idx_unique_email', ['email'], true);
      });

      const diff = builder.toDiff();
      const table = getTableCreate(diff, 'users');

      expect(table!.indexes[0].unique).toBe(true);
    });

    it('should create table with foreign key', () => {
      builder.createTable('posts', (t) => {
        t.column('id', 'INTEGER');
        t.column('user_id', 'INTEGER');
        t.foreignKey({
          columns: ['user_id'],
          refTable: 'users',
          refColumns: ['id']
        });
      });

      const diff = builder.toDiff();
      const table = getTableCreate(diff, 'posts');

      expect(table!.foreignKeys).toHaveLength(1);
      expect(table!.foreignKeys[0].refTable).toBe('users');
    });
  });

  describe('dropTable()', () => {
    it('should mark table for drop', () => {
      builder.dropTable('old_table');

      const diff = builder.toDiff();
      const tableDiff = getTableDrop(diff, 'old_table');

      expect(tableDiff).toBeDefined();
    });

    it('should drop multiple tables', () => {
      builder.dropTable('table1').dropTable('table2');

      const diff = builder.toDiff();

      expect(getTableDrop(diff, 'table1')).toBeDefined();
      expect(getTableDrop(diff, 'table2')).toBeDefined();
    });
  });

  describe('alterTable()', () => {
    it('should add column to table', () => {
      builder.alterTable('users', (t) => {
        t.addColumn('age', 'INTEGER');
      });

      const diff = builder.toDiff();
      const addChanges = getColumnChanges(diff, 'users', 'add');

      expect(addChanges).toHaveLength(1);
      expect(addChanges[0].column.name).toBe('age');
      expect(addChanges[0].column.type).toBe('INTEGER');
    });

    it('should add column with nullable option', () => {
      builder.alterTable('users', (t) => {
        t.addColumn('email', 'VARCHAR', { nullable: false });
      });

      const diff = builder.toDiff();
      const addChanges = getColumnChanges(diff, 'users', 'add');

      expect(addChanges[0].column.nullable).toBe(false);
    });

    it('should alter column type', () => {
      builder.alterTable('users', (t) => {
        t.alterColumn('age', 'BIGINT');
      });

      const diff = builder.toDiff();
      const alterChanges = getColumnChanges(diff, 'users', 'alter');

      expect(alterChanges).toHaveLength(1);
      expect(alterChanges[0].column.name).toBe('age');
      expect(alterChanges[0].column.type).toBe('BIGINT');
    });

    it('should drop column from table', () => {
      builder.alterTable('users', (t) => {
        t.dropColumn('old_field');
      });

      const diff = builder.toDiff();
      const dropChanges = getColumnChanges(diff, 'users', 'drop');

      expect(dropChanges).toHaveLength(1);
      expect(dropChanges[0].column.name).toBe('old_field');
    });

    it('should support mixed column operations', () => {
      builder.alterTable('users', (t) => {
        t.addColumn('age', 'INTEGER');
        t.alterColumn('email', 'VARCHAR', { nullable: false });
        t.dropColumn('old_field');
      });

      const diff = builder.toDiff();

      expect(getColumnChanges(diff, 'users', 'add')).toHaveLength(1);
      expect(getColumnChanges(diff, 'users', 'alter')).toHaveLength(1);
      expect(getColumnChanges(diff, 'users', 'drop')).toHaveLength(1);
    });
  });

  describe('renameTable()', () => {
    it('should rename table', () => {
      builder.renameTable('old_name', 'new_name');

      const diff = builder.toDiff();
      const tableDiff = getTableDiff(diff, 'old_name');

      expect(tableDiff!.renameTo).toBe('new_name');
    });
  });

  describe('renameColumn()', () => {
    it('should rename column', () => {
      builder.renameColumn('users', 'old_name', 'new_name');

      const diff = builder.toDiff();
      const tableDiff = getTableDiff(diff, 'users');

      expect(tableDiff!.columnRenames).toHaveLength(1);
      expect(tableDiff!.columnRenames![0].from).toBe('old_name');
      expect(tableDiff!.columnRenames![0].to).toBe('new_name');
    });
  });

  describe('createIndex()', () => {
    it('should create index', () => {
      builder.createIndex('users', 'idx_email', ['email']);

      const diff = builder.toDiff();
      const tableDiff = getTableDiff(diff, 'users');

      expect(tableDiff!.indexCreates).toHaveLength(1);
      expect(tableDiff!.indexCreates![0].name).toBe('idx_email');
      expect(tableDiff!.indexCreates![0].columns).toEqual(['email']);
    });

    it('should create unique index', () => {
      builder.createIndex('users', 'idx_email', ['email'], true);

      const diff = builder.toDiff();
      const tableDiff = getTableDiff(diff, 'users');

      expect(tableDiff!.indexCreates![0].unique).toBe(true);
    });
  });

  describe('dropIndex()', () => {
    it('should drop index', () => {
      builder.dropIndex('users', 'idx_email');

      const diff = builder.toDiff();
      const tableDiff = getTableDiff(diff, 'users');

      expect(tableDiff!.indexDrops).toHaveLength(1);
      expect(tableDiff!.indexDrops![0]).toBe('idx_email');
    });
  });

  describe('addForeignKey()', () => {
    it('should create foreign key', () => {
      builder.addForeignKey('posts', {
        columns: ['user_id'],
        refTable: 'users',
        refColumns: ['id']
      });

      const diff = builder.toDiff();
      const tableDiff = getTableDiff(diff, 'posts');

      expect(tableDiff!.fkCreates).toHaveLength(1);
      expect(tableDiff!.fkCreates![0].refTable).toBe('users');
    });

    it('should create foreign key with cascade options', () => {
      builder.addForeignKey('posts', {
        columns: ['user_id'],
        refTable: 'users',
        refColumns: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'SET NULL'
      });

      const diff = builder.toDiff();
      const tableDiff = getTableDiff(diff, 'posts');
      const fk = tableDiff!.fkCreates![0];

      expect(fk.onDelete).toBe('CASCADE');
      expect(fk.onUpdate).toBe('SET NULL');
    });
  });

  describe('dropForeignKey()', () => {
    it('should drop foreign key', () => {
      builder.dropForeignKey('posts', 'fk_posts_user');

      const diff = builder.toDiff();
      const tableDiff = getTableDiff(diff, 'posts');

      expect(tableDiff!.fkDrops).toHaveLength(1);
      expect(tableDiff!.fkDrops![0]).toBe('fk_posts_user');
    });
  });

  describe('complex migrations', () => {
    it('should handle multiple table operations', () => {
      builder
        .createTable('users', (t) => {
          t.column('id', 'INTEGER');
          t.primaryKey('id');
        })
        .createTable('posts', (t) => {
          t.column('id', 'INTEGER');
          t.column('user_id', 'INTEGER');
          t.primaryKey('id');
          t.foreignKey({
            columns: ['user_id'],
            refTable: 'users',
            refColumns: ['id']
          });
        })
        .dropTable('old_table');

      const diff = builder.toDiff();

      expect(getTableCreate(diff, 'users')).toBeDefined();
      expect(getTableCreate(diff, 'posts')).toBeDefined();
      expect(getTableDrop(diff, 'old_table')).toBeDefined();
    });

    it('should handle mixed operations', () => {
      builder
        .createTable('new_table', (t) => {
          t.column('id', 'INTEGER');
        })
        .alterTable('existing_table', (t) => {
          t.addColumn('new_field', 'VARCHAR');
          t.dropColumn('old_field');
        })
        .dropTable('obsolete_table')
        .renameTable('old_name', 'new_name')
        .createIndex('users', 'idx_email', ['email'])
        .dropIndex('posts', 'idx_old');

      const diff = builder.toDiff();

      expect(getTableCreate(diff, 'new_table')).toBeDefined();
      expect(getColumnChanges(diff, 'existing_table')).toHaveLength(2);
      expect(getTableDrop(diff, 'obsolete_table')).toBeDefined();
      expect(getTableDiff(diff, 'old_name')!.renameTo).toBe('new_name');
      expect(getTableDiff(diff, 'users')!.indexCreates).toHaveLength(1);
      expect(getTableDiff(diff, 'posts')!.indexDrops).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty builder', () => {
      const diff = builder.toDiff();

      expect(diff.tables).toHaveLength(0);
    });

    it('should handle column with null default value', () => {
      builder.createTable('users', (t) => {
        t.column('optional_field', 'VARCHAR', { defaultValue: null });
      });

      const diff = builder.toDiff();
      const table = getTableCreate(diff, 'users');

      expect(table!.columns[0].defaultValue).toBeNull();
    });

    it('should handle column with zero default value', () => {
      builder.createTable('counters', (t) => {
        t.column('count', 'INTEGER', { defaultValue: 0 });
      });

      const diff = builder.toDiff();
      const table = getTableCreate(diff, 'counters');

      expect(table!.columns[0].defaultValue).toBe(0);
    });
  });
});
