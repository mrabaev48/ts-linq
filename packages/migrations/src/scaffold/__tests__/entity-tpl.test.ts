import type { DatabaseTableModel } from '@ts-linq/types';

import { renderEntityTemplate } from '../templates/entity.tpl';

const opts = { useDatabaseNames: false, pluralize: false };

function makeTable(partial: Partial<DatabaseTableModel> & { name: string }): DatabaseTableModel {
  return {
    columns: [],
    primaryKeys: [],
    foreignKeys: [],
    indexes: [],
    ...partial
  };
}

describe('renderEntityTemplate', () => {
  it('generates basic entity with PK column', () => {
    const table = makeTable({
      name: 'orders',
      columns: [
        {
          name: 'id',
          dbType: 'int',
          ormType: 'INTEGER',
          nullable: false,
          isPrimary: true,
          isIdentity: true
        }
      ],
      primaryKeys: ['id']
    });
    const result = renderEntityTemplate(table, [table], opts);
    expect(result).toContain('export class Order {');
    expect(result).toContain('@PrimaryKey({');
    expect(result).toContain('autoIncrement: true');
    expect(result).toContain('public id!: number;');
  });

  it('generates nullable column with union type', () => {
    const table = makeTable({
      name: 'users',
      columns: [
        {
          name: 'email',
          dbType: 'varchar',
          ormType: 'TEXT',
          nullable: true,
          isPrimary: false,
          isIdentity: false
        }
      ],
      primaryKeys: []
    });
    const result = renderEntityTemplate(table, [table], opts);
    expect(result).toContain('string | null');
  });

  it('generates composite PK columns', () => {
    const table = makeTable({
      name: 'order_items',
      columns: [
        {
          name: 'order_id',
          dbType: 'int',
          ormType: 'INTEGER',
          nullable: false,
          isPrimary: true,
          isIdentity: false
        },
        {
          name: 'product_id',
          dbType: 'int',
          ormType: 'INTEGER',
          nullable: false,
          isPrimary: true,
          isIdentity: false
        }
      ],
      primaryKeys: ['order_id', 'product_id']
    });
    const result = renderEntityTemplate(table, [table], opts);
    const pkCount = (result.match(/@PrimaryKey/g) || []).length;
    expect(pkCount).toBe(2);
  });

  it('adds @Index decorator for non-PK indexes', () => {
    const table = makeTable({
      name: 'products',
      columns: [
        {
          name: 'id',
          dbType: 'int',
          ormType: 'INTEGER',
          nullable: false,
          isPrimary: true,
          isIdentity: true
        },
        {
          name: 'sku',
          dbType: 'varchar',
          ormType: 'TEXT',
          nullable: false,
          isPrimary: false,
          isIdentity: false
        }
      ],
      primaryKeys: ['id'],
      indexes: [{ name: 'idx_sku', columns: ['sku'], unique: true }]
    });
    const result = renderEntityTemplate(table, [table], opts);
    expect(result).toContain('@Index(');
    expect(result).toContain("'sku'");
    expect(result).toContain('unique: true');
  });

  it('generates ManyToOne for FK', () => {
    const users = makeTable({
      name: 'users',
      columns: [
        {
          name: 'id',
          dbType: 'int',
          ormType: 'INTEGER',
          nullable: false,
          isPrimary: true,
          isIdentity: true
        }
      ],
      primaryKeys: ['id']
    });
    const orders = makeTable({
      name: 'orders',
      columns: [
        {
          name: 'id',
          dbType: 'int',
          ormType: 'INTEGER',
          nullable: false,
          isPrimary: true,
          isIdentity: true
        },
        {
          name: 'user_id',
          dbType: 'int',
          ormType: 'INTEGER',
          nullable: false,
          isPrimary: false,
          isIdentity: false
        }
      ],
      primaryKeys: ['id'],
      foreignKeys: [
        {
          name: 'fk_order_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id']
        }
      ]
    });
    const result = renderEntityTemplate(orders, [orders, users], opts);
    expect(result).toContain('@ManyToOne');
    expect(result).toContain('() => User');
  });
});
