import { createMetadataRegistry } from '@ts-linq/metadata';
import type { ForeignKeyDef, TableSnapshot } from '@ts-linq/migrations';
import { buildCreateTableSql, buildInlineFkSql, deleteBehaviorToSql } from '@ts-linq/migrations';
import { DeleteBehavior } from '@ts-linq/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTableWithFk(onDelete?: string): TableSnapshot {
  return {
    name: 'posts',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
      { name: 'blogId', type: 'INTEGER', nullable: true }
    ],
    primaryKeys: ['id'],
    indexes: [],
    foreignKeys: [
      {
        columns: ['blogId'],
        refTable: 'blogs',
        refColumns: ['id'],
        onDelete
      } as ForeignKeyDef
    ]
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Cascade Delete Behaviors — DDL', () => {
  describe('deleteBehaviorToSql()', () => {
    it.each([
      [DeleteBehavior.Cascade, 'CASCADE'],
      [DeleteBehavior.Restrict, 'RESTRICT'],
      [DeleteBehavior.SetNull, 'SET NULL'],
      [DeleteBehavior.NoAction, 'NO ACTION']
    ] as const)('%s → "%s"', (behavior, expected) => {
      expect(deleteBehaviorToSql(behavior)).toBe(expected);
    });

    it.each([
      DeleteBehavior.ClientSetNull,
      DeleteBehavior.ClientCascade,
      DeleteBehavior.ClientNoAction
    ])('%s → undefined (no DB clause)', (behavior) => {
      expect(deleteBehaviorToSql(behavior)).toBeUndefined();
    });
  });

  describe('buildInlineFkSql: ON DELETE clause per dialect', () => {
    it.each<[string, string]>([
      ['CASCADE', 'ON DELETE CASCADE'],
      ['RESTRICT', 'ON DELETE RESTRICT'],
      ['SET NULL', 'ON DELETE SET NULL'],
      ['NO ACTION', 'ON DELETE NO ACTION']
    ])('postgresql emits %s', (onDelete, expectedClause) => {
      const sql = buildInlineFkSql('postgresql', {
        columns: ['blogId'],
        refTable: 'blogs',
        refColumns: ['id'],
        onDelete
      });
      expect(sql).toContain(expectedClause);
    });

    it.each<[string, string]>([
      ['CASCADE', 'ON DELETE CASCADE'],
      ['RESTRICT', 'ON DELETE RESTRICT'],
      ['SET NULL', 'ON DELETE SET NULL'],
      ['NO ACTION', 'ON DELETE NO ACTION']
    ])('mysql emits %s', (onDelete, expectedClause) => {
      const sql = buildInlineFkSql('mysql', {
        columns: ['blogId'],
        refTable: 'blogs',
        refColumns: ['id'],
        onDelete
      });
      expect(sql).toContain(expectedClause);
    });

    it.each<[string, string]>([
      ['CASCADE', 'ON DELETE CASCADE'],
      ['RESTRICT', 'ON DELETE RESTRICT'],
      ['SET NULL', 'ON DELETE SET NULL'],
      ['NO ACTION', 'ON DELETE NO ACTION']
    ])('mssql emits %s', (onDelete, expectedClause) => {
      const sql = buildInlineFkSql('mssql', {
        columns: ['blogId'],
        refTable: 'blogs',
        refColumns: ['id'],
        onDelete
      });
      expect(sql).toContain(expectedClause);
    });

    it('omits ON DELETE clause when not specified', () => {
      const sql = buildInlineFkSql('postgresql', {
        columns: ['blogId'],
        refTable: 'blogs',
        refColumns: ['id']
      });
      expect(sql).not.toContain('ON DELETE');
    });
  });

  describe('CREATE TABLE DDL includes FK with ON DELETE', () => {
    it.each<[string, string]>([
      ['CASCADE', 'ON DELETE CASCADE'],
      ['SET NULL', 'ON DELETE SET NULL'],
      ['RESTRICT', 'ON DELETE RESTRICT']
    ])('postgres CREATE TABLE includes %s', (onDelete, expectedClause) => {
      const table = makeTableWithFk(onDelete);
      const sql = buildCreateTableSql({ create: table, table: table.name }, 'postgresql');
      expect(sql).toContain(expectedClause);
      expect(sql).toContain('REFERENCES');
    });
  });

  describe('Fluent API: onDelete() wires into RelationshipMetadata', () => {
    it('stores DeleteBehavior on the relationship metadata', () => {
      const registry = createMetadataRegistry();

      class Blog {
        id!: number;
      }
      class Post {
        id!: number;
        blogId!: number;
      }

      registry.addEntity(Blog, 'blogs');
      registry.setFluentPrimaryKeys(Blog, ['id']);
      registry.mergeFluentColumn(Blog, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      });

      registry.addEntity(Post, 'posts');
      registry.setFluentPrimaryKeys(Post, ['id']);
      registry.mergeFluentColumn(Post, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      });
      registry.mergeFluentRelationship(Post, {
        propertyName: 'blog',
        type: 'many-to-one',
        targetEntity: Blog,
        foreignKey: 'blogId',
        onDelete: DeleteBehavior.Cascade
      });

      const postMeta = registry.getEntity(Post);
      const rel = postMeta?.relationships.find((r) => r.propertyName === 'blog');
      expect(rel?.onDelete).toBe(DeleteBehavior.Cascade);
    });

    it.each([
      DeleteBehavior.Cascade,
      DeleteBehavior.Restrict,
      DeleteBehavior.SetNull,
      DeleteBehavior.ClientSetNull,
      DeleteBehavior.NoAction,
      DeleteBehavior.ClientCascade,
      DeleteBehavior.ClientNoAction
    ])('stores %s in relationship metadata', (behavior) => {
      const registry = createMetadataRegistry();

      class Principal {
        id!: number;
      }
      class Dependent {
        id!: number;
        principalId!: number;
      }

      registry.addEntity(Principal, 'principals');
      registry.setFluentPrimaryKeys(Principal, ['id']);
      registry.mergeFluentColumn(Principal, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      });

      registry.addEntity(Dependent, 'dependents');
      registry.setFluentPrimaryKeys(Dependent, ['id']);
      registry.mergeFluentRelationship(Dependent, {
        propertyName: 'principal',
        type: 'many-to-one',
        targetEntity: Principal,
        foreignKey: 'principalId',
        onDelete: behavior
      });

      const meta = registry.getEntity(Dependent);
      const rel = meta?.relationships.find((r) => r.propertyName === 'principal');
      expect(rel?.onDelete).toBe(behavior);
    });
  });
});
