import type { SchemaDiff } from '../../../src/DiffTypes';

/**
 * Exhaustive `SchemaDiff` used as the byte-equality baseline for the migrations↔dialect DDL
 * convergence (dialect-postgres/task-10). It deliberately exercises every emission path the
 * migration SQL builders own:
 *
 * - CREATE TABLE with scalar/computed columns, single + composite PK, inline FKs, indexes,
 *   named UNIQUE constraints, table/column comments and CHECK constraints;
 * - literal defaults of every supported shape (string with a quote, number, boolean, null),
 *   `defaultExpression`, and the per-dialect `defaultExpressionDialect` override;
 * - "unknown" physical types (`VARCHAR(255)`, `DECIMAL(10,2)`, `UUID`, `BLOB`) alongside the
 *   logical ones, which pin the passthrough behaviour of the migrations type mapping;
 * - identifiers containing the per-dialect escape character, which pin identifier quoting;
 * - ALTER paths: add/alter/drop column, column renames, unique + index + FK create/drop;
 * - table rename, table drop, sequences and seed rows.
 */
export const ddlConvergenceDiff: SchemaDiff = {
  tables: [
    {
      table: 'app_user',
      create: {
        name: 'app_user',
        comment: "user's table",
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
          { name: 'tenant_id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
          { name: 'email', type: 'STRING', nullable: false, comment: "user's e-mail" },
          { name: 'nick"name`weird]', type: 'TEXT', nullable: true },
          { name: 'age', type: 'NUMBER', nullable: true, defaultValue: 18 },
          { name: 'balance', type: 'DECIMAL(10,2)', nullable: false, defaultValue: 0 },
          { name: 'code', type: 'VARCHAR(255)', nullable: true, defaultValue: "o'brien" },
          { name: 'external_id', type: 'UUID', nullable: true },
          { name: 'avatar', type: 'BLOB', nullable: true },
          { name: 'is_active', type: 'BOOLEAN', nullable: false, defaultValue: true },
          { name: 'is_deleted', type: 'BOOLEAN', nullable: false, defaultValue: false },
          { name: 'deleted_at', type: 'DATETIME', nullable: true, defaultValue: null },
          { name: 'rating', type: 'REAL', nullable: true, defaultValue: 1.5 },
          {
            name: 'created_at',
            type: 'DATETIME',
            nullable: false,
            defaultExpression: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updated_at',
            type: 'DATETIME',
            nullable: false,
            defaultExpression: 'CURRENT_TIMESTAMP',
            defaultExpressionDialect: {
              postgresql: 'NOW()',
              mysql: 'CURRENT_TIMESTAMP(6)',
              mssql: 'SYSUTCDATETIME()'
            }
          },
          {
            name: 'full_name',
            type: 'TEXT',
            nullable: true,
            isComputed: true,
            computedExpression: "first_name || ' ' || last_name",
            computedStorage: 'STORED'
          },
          {
            name: 'virtual_name',
            type: 'TEXT',
            nullable: true,
            isComputed: true,
            computedExpression: 'UPPER(email)',
            computedStorage: 'VIRTUAL'
          },
          {
            name: 'persisted_name',
            type: 'TEXT',
            nullable: true,
            isComputed: true,
            computedExpression: 'LOWER(email)',
            computedStorage: 'PERSISTED'
          },
          {
            name: 'no_storage_computed',
            type: 'TEXT',
            nullable: true,
            isComputed: true,
            computedExpression: 'TRIM(email)'
          }
        ],
        primaryKeys: ['id', 'tenant_id'],
        indexes: [
          { name: 'ix_app_user_email', columns: ['email'], unique: true },
          {
            name: 'ix_app_user_active',
            columns: ['is_active'],
            unique: false,
            where: 'is_active = true'
          }
        ],
        foreignKeys: [
          {
            name: 'fk_app_user_tenant',
            columns: ['tenant_id'],
            refTable: 'tenant',
            refColumns: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'NO ACTION'
          }
        ],
        checkConstraints: [{ name: 'ck_app_user_age', sql: 'age >= 0' }],
        uniqueConstraints: [{ name: 'ak_app_user_email', columns: ['email', 'tenant_id'] }]
      }
    },
    {
      table: 'orders',
      columnChanges: [
        {
          kind: 'add',
          column: { name: 'note', type: 'STRING', nullable: true, comment: 'free-form note' }
        },
        {
          kind: 'add',
          column: { name: 'total', type: 'DECIMAL(10,2)', nullable: false, defaultValue: 0 }
        },
        {
          kind: 'add',
          column: { name: 'paid', type: 'BOOLEAN', nullable: false, defaultValue: false }
        },
        {
          kind: 'add',
          column: {
            name: 'placed_at',
            type: 'DATETIME',
            nullable: false,
            defaultExpression: 'CURRENT_TIMESTAMP'
          }
        },
        {
          kind: 'add',
          column: {
            name: 'summary',
            type: 'TEXT',
            nullable: true,
            isComputed: true,
            computedExpression: 'CONCAT(note, total)',
            computedStorage: 'STORED'
          }
        },
        {
          kind: 'alter',
          prev: { name: 'total', type: 'REAL', nullable: false },
          column: { name: 'total', type: 'DECIMAL(10,2)', nullable: true }
        },
        {
          kind: 'alter',
          prev: {
            name: 'summary',
            type: 'TEXT',
            nullable: true,
            isComputed: true,
            computedExpression: 'CONCAT(note)',
            computedStorage: 'STORED'
          },
          column: {
            name: 'summary',
            type: 'TEXT',
            nullable: true,
            isComputed: true,
            computedExpression: 'CONCAT(note, total)',
            computedStorage: 'STORED'
          }
        },
        { kind: 'drop', column: { name: 'legacy_flag', type: 'BOOLEAN', nullable: true } }
      ],
      columnRenames: [{ from: 'qty', to: 'quantity' }],
      uniqueConstraintCreates: [{ name: 'ak_orders_number', columns: ['number'] }],
      uniqueConstraintDrops: ['ak_orders_legacy'],
      indexCreates: [{ name: 'ix_orders_placed_at', columns: ['placed_at'], unique: false }],
      indexDrops: ['ix_orders_legacy'],
      fkCreates: [
        {
          name: 'fk_orders_user',
          columns: ['user_id', 'tenant_id'],
          refTable: 'app_user',
          refColumns: ['id', 'tenant_id'],
          onDelete: 'CASCADE'
        }
      ],
      fkDrops: ['fk_orders_legacy']
    },
    { table: 'audit_log', renameTo: 'audit_trail' },
    { table: 'obsolete', drop: true }
  ],
  sequenceOps: [
    {
      kind: 'create',
      sequence: { name: 'order_seq', startsAt: 1, incrementsBy: 1, type: 'int' }
    }
  ],
  seedOps: [
    {
      kind: 'insert',
      table: 'tenant',
      pkColumns: ['id'],
      row: { id: 1, name: "acme's", active: true }
    },
    {
      kind: 'update',
      table: 'tenant',
      pkColumns: ['id'],
      row: { id: 1, name: 'acme', active: false },
      prev: { id: 1, name: "acme's", active: true }
    },
    { kind: 'delete', table: 'tenant', pkColumns: ['id'], row: { id: 2, name: 'old' } }
  ]
};
