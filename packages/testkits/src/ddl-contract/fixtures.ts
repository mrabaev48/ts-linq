import type { ColumnMetadata, EntityMetadata, ForeignKeySpec } from '@ts-linq/types';

/** Build a `ColumnMetadata` fixture; `propertyName` defaults to `columnName`. */
export function column(
  overrides: Partial<ColumnMetadata> & { columnName: string; type: string }
): ColumnMetadata {
  return {
    propertyName: overrides.columnName,
    ...overrides
  } as ColumnMetadata;
}

/** Build an `EntityMetadata` fixture with the mandatory empty collections filled in. */
function entity(overrides: Partial<EntityMetadata> & { tableName: string }): EntityMetadata {
  return {
    columns: [],
    relationships: [],
    indexes: [],
    ...overrides
  } as EntityMetadata;
}

// ─── Entity fixtures (CREATE TABLE / comment) ──────────────────────────────────

export const simpleEntity: EntityMetadata = entity({
  tableName: 'users',
  columns: [
    column({ columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true }),
    column({ columnName: 'name', type: 'STRING', nullable: false }),
    column({ columnName: 'age', type: 'INTEGER', nullable: true })
  ],
  primaryKeys: ['id']
});

export const compositePkEntity: EntityMetadata = entity({
  tableName: 'order_items',
  columns: [
    column({ columnName: 'order_id', type: 'INTEGER', nullable: false }),
    column({ columnName: 'product_id', type: 'INTEGER', nullable: false }),
    column({ columnName: 'quantity', type: 'INTEGER', nullable: false })
  ],
  primaryKeys: ['order_id', 'product_id']
});

export const computedCheckEntity: EntityMetadata = entity({
  tableName: 'products',
  columns: [
    column({ columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true }),
    column({ columnName: 'price', type: 'INTEGER', nullable: false }),
    column({
      columnName: 'total',
      type: 'INTEGER',
      nullable: true,
      isComputed: true,
      computedExpression: 'price * 2'
    })
  ],
  primaryKeys: ['id'],
  checkConstraints: [{ name: 'chk_price', sql: 'price > 0' }]
});

export const commentedEntity: EntityMetadata = entity({
  tableName: 'accounts',
  comment: 'User accounts',
  columns: [
    column({ columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true }),
    column({ columnName: 'email', type: 'STRING', nullable: false, comment: 'Login email' })
  ],
  primaryKeys: ['id']
});

// ─── Column fixtures (column definition) ───────────────────────────────────────

export const plainColumn = column({ columnName: 'name', type: 'STRING', nullable: true });
export const notNullDefaultColumn = column({
  columnName: 'active',
  type: 'BOOLEAN',
  nullable: false,
  defaultValue: true
});
export const generatedColumn = column({
  columnName: 'id',
  type: 'INTEGER',
  nullable: false,
  isGenerated: true
});
export const computedColumn = column({
  columnName: 'total',
  type: 'INTEGER',
  nullable: true,
  isComputed: true,
  computedExpression: 'a + b'
});
export const lengthColumn = column({
  columnName: 'code',
  type: 'STRING',
  nullable: true,
  length: 50
});

// ─── Foreign-key fixtures ──────────────────────────────────────────────────────

export const simpleFk: ForeignKeySpec = {
  name: 'fk_posts_user',
  columnName: 'user_id',
  relatedTableName: 'users',
  relatedColumnName: 'id'
};

export const cascadeFk: ForeignKeySpec = {
  ...simpleFk,
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
};
