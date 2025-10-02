import 'reflect-metadata';
import { DdlBuilder } from '../../src/DdlBuilder';
import type { DdlStrategy } from '../../src/migrations/DdlStrategy';
import type { EntityMetadata, ColumnMetadata } from '../../src/types';

describe('DdlBuilder advanced scenarios', () => {
  describe('NULL and DEFAULT constraints', () => {
    it('should handle NOT NULL columns', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn((metadata) => {
          const columns = metadata.columns
            .map((col: ColumnMetadata) => {
              const nullable = col.nullable !== false ? '' : ' NOT NULL';
              return `${col.columnName} ${col.type}${nullable}`;
            })
            .join(', ');
          return `CREATE TABLE ${metadata.tableName} (${columns})`;
        }),
        generateCreateIndexSql: jest.fn()
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'test_table',
        primaryKeys: ['id'],
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
          } as ColumnMetadata,
          {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            nullable: false
          } as ColumnMetadata,
          {
            propertyName: 'optional',
            columnName: 'optional',
            type: 'TEXT',
            nullable: true
          } as ColumnMetadata
        ],
        relationships: [],
        indexes: []
      };

      const sql = builder.buildCreateTableSql(metadata);

      expect(sql).toContain('id INTEGER NOT NULL');
      expect(sql).toContain('name TEXT NOT NULL');
      expect(sql).toContain('optional TEXT');
      expect(sql).not.toContain('optional TEXT NOT NULL');
    });

    it('should handle DEFAULT values', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn((metadata) => {
          const columns = metadata.columns
            .map((col: ColumnMetadata) => {
              let def = '';
              if (col.defaultValue !== undefined) {
                const value =
                  typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue;
                def = ` DEFAULT ${value}`;
              }
              return `${col.columnName} ${col.type}${def}`;
            })
            .join(', ');
          return `CREATE TABLE ${metadata.tableName} (${columns})`;
        }),
        generateCreateIndexSql: jest.fn()
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'test_table',
        primaryKeys: ['id'],
        columns: [
          {
            propertyName: 'status',
            columnName: 'status',
            type: 'TEXT',
            defaultValue: 'pending'
          } as ColumnMetadata,
          {
            propertyName: 'count',
            columnName: 'count',
            type: 'INTEGER',
            defaultValue: 0
          } as ColumnMetadata
        ],
        relationships: [],
        indexes: []
      };

      const sql = builder.buildCreateTableSql(metadata);

      expect(sql).toContain("status TEXT DEFAULT 'pending'");
      expect(sql).toContain('count INTEGER DEFAULT 0');
    });

    it('should handle DEFAULT expressions', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn((metadata) => {
          const columns = metadata.columns
            .map((col: ColumnMetadata) => {
              let def = '';
              if ('defaultExpression' in col && col.defaultExpression) {
                def = ` DEFAULT ${col.defaultExpression}`;
              }
              return `${col.columnName} ${col.type}${def}`;
            })
            .join(', ');
          return `CREATE TABLE ${metadata.tableName} (${columns})`;
        }),
        generateCreateIndexSql: jest.fn()
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'test_table',
        primaryKeys: ['id'],
        columns: [
          {
            propertyName: 'createdAt',
            columnName: 'created_at',
            type: 'TIMESTAMP',
            defaultExpression: 'CURRENT_TIMESTAMP'
          } as ColumnMetadata & { defaultExpression: string },
          {
            propertyName: 'uuid',
            columnName: 'uuid',
            type: 'TEXT',
            defaultExpression: 'uuid_generate_v4()'
          } as ColumnMetadata & { defaultExpression: string }
        ],
        relationships: [],
        indexes: []
      };

      const sql = builder.buildCreateTableSql(metadata);

      expect(sql).toContain('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      expect(sql).toContain('uuid TEXT DEFAULT uuid_generate_v4()');
    });
  });

  describe('computed columns', () => {
    it('should handle GENERATED ALWAYS AS for computed columns', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn((metadata) => {
          const columns = metadata.columns
            .map((col: ColumnMetadata) => {
              if ('computed' in col && col.computed) {
                const expr = typeof col.computed === 'string' ? col.computed : '(some_expr)';
                return `${col.columnName} ${col.type} GENERATED ALWAYS AS ${expr} STORED`;
              }
              return `${col.columnName} ${col.type}`;
            })
            .join(', ');
          return `CREATE TABLE ${metadata.tableName} (${columns})`;
        }),
        generateCreateIndexSql: jest.fn()
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'users',
        primaryKeys: ['id'],
        columns: [
          {
            propertyName: 'firstName',
            columnName: 'first_name',
            type: 'TEXT'
          } as ColumnMetadata,
          {
            propertyName: 'lastName',
            columnName: 'last_name',
            type: 'TEXT'
          } as ColumnMetadata,
          {
            propertyName: 'fullName',
            columnName: 'full_name',
            type: 'TEXT',
            computed: "(first_name || ' ' || last_name)"
          } as ColumnMetadata & { computed: string }
        ],
        relationships: [],
        indexes: []
      };

      const sql = builder.buildCreateTableSql(metadata);

      expect(sql).toContain('first_name TEXT');
      expect(sql).toContain('last_name TEXT');
      expect(sql).toContain(
        "full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED"
      );
    });
  });

  describe('foreign key constraints', () => {
    it('should handle FK definitions', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn((metadata) => {
          const columns = metadata.columns
            .map((col: ColumnMetadata) => `${col.columnName} ${col.type}`)
            .join(', ');
          const fks = metadata.relationships
            .filter((rel) => rel.type === 'many-to-one')
            .map((rel) => {
              const fkCol = rel.foreignKey || 'id';
              const refTable = 'referenced_table'; // Simplified
              return `FOREIGN KEY (${fkCol}) REFERENCES ${refTable}(id)`;
            })
            .join(', ');
          return fks
            ? `CREATE TABLE ${metadata.tableName} (${columns}, ${fks})`
            : `CREATE TABLE ${metadata.tableName} (${columns})`;
        }),
        generateCreateIndexSql: jest.fn()
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'orders',
        primaryKeys: ['id'],
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER'
          } as ColumnMetadata,
          {
            propertyName: 'userId',
            columnName: 'user_id',
            type: 'INTEGER'
          } as ColumnMetadata
        ],
        relationships: [
          {
            propertyName: 'user',
            type: 'many-to-one',
            targetEntity: class User {},
            foreignKey: 'user_id'
          }
        ],
        indexes: []
      };

      const sql = builder.buildCreateTableSql(metadata);

      expect(sql).toContain('FOREIGN KEY');
      expect(sql).toContain('REFERENCES');
      expect(sql).toContain('user_id');
    });

    it('should handle ON DELETE and ON UPDATE actions', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn((metadata) => {
          const columns = metadata.columns
            .map((col: ColumnMetadata) => `${col.columnName} ${col.type}`)
            .join(', ');
          const fks = metadata.relationships
            .filter((rel) => rel.type === 'many-to-one')
            .map((rel) => {
              const fkCol = rel.foreignKey || 'id';
              const refTable = 'users';
              return `FOREIGN KEY (${fkCol}) REFERENCES ${refTable}(id) ON DELETE CASCADE`;
            })
            .join(', ');
          return fks
            ? `CREATE TABLE ${metadata.tableName} (${columns}, ${fks})`
            : `CREATE TABLE ${metadata.tableName} (${columns})`;
        }),
        generateCreateIndexSql: jest.fn()
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'posts',
        primaryKeys: ['id'],
        columns: [
          {
            propertyName: 'userId',
            columnName: 'user_id',
            type: 'INTEGER'
          } as ColumnMetadata
        ],
        relationships: [
          {
            propertyName: 'user',
            type: 'many-to-one',
            targetEntity: class User {},
            foreignKey: 'user_id'
          }
        ],
        indexes: []
      };

      const sql = builder.buildCreateTableSql(metadata);

      expect(sql).toContain('ON DELETE CASCADE');
    });
  });

  describe('collation and charset', () => {
    it('should handle column collation', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn((metadata) => {
          const columns = metadata.columns
            .map((col: ColumnMetadata) => {
              let collation = '';
              if ('collation' in col && (col as unknown as { collation?: unknown }).collation) {
                const coll = String((col as unknown as { collation?: unknown }).collation);
                collation = ` COLLATE ${coll}`;
              }
              return `${col.columnName} ${col.type}${collation}`;
            })
            .join(', ');
          return `CREATE TABLE ${metadata.tableName} (${columns})`;
        }),
        generateCreateIndexSql: jest.fn()
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'test_table',
        primaryKeys: ['id'],
        columns: [
          {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            collation: 'NOCASE'
          } as ColumnMetadata & { collation: string },
          {
            propertyName: 'email',
            columnName: 'email',
            type: 'TEXT',
            collation: 'utf8mb4_unicode_ci'
          } as ColumnMetadata & { collation: string }
        ],
        relationships: [],
        indexes: []
      };

      const sql = builder.buildCreateTableSql(metadata);

      expect(sql).toContain('name TEXT COLLATE NOCASE');
      expect(sql).toContain('email TEXT COLLATE utf8mb4_unicode_ci');
    });
  });

  describe('complex indexes', () => {
    it('should handle composite indexes', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn(() => 'CREATE TABLE test_table (id INTEGER)'),
        generateCreateIndexSql: jest.fn((tableName, index) => {
          const cols = index.columns.join(', ');
          const unique = index.unique ? 'UNIQUE ' : '';
          return `CREATE ${unique}INDEX ${index.name} ON ${tableName} (${cols})`;
        })
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'test_table',
        primaryKeys: ['id'],
        columns: [
          { propertyName: 'col1', columnName: 'col1', type: 'TEXT' } as ColumnMetadata,
          { propertyName: 'col2', columnName: 'col2', type: 'TEXT' } as ColumnMetadata
        ],
        relationships: [],
        indexes: [
          {
            name: 'idx_composite',
            columns: ['col1', 'col2'],
            unique: false
          }
        ]
      };

      const indexes = builder.buildCreateIndexesSql(metadata);

      expect(indexes).toHaveLength(1);
      expect(indexes[0]).toContain('idx_composite');
      expect(indexes[0]).toContain('col1, col2');
    });

    it('should handle unique indexes', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn(() => 'CREATE TABLE test_table (id INTEGER)'),
        generateCreateIndexSql: jest.fn((tableName, index) => {
          const cols = index.columns.join(', ');
          const unique = index.unique ? 'UNIQUE ' : '';
          return `CREATE ${unique}INDEX ${index.name} ON ${tableName} (${cols})`;
        })
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'test_table',
        primaryKeys: ['id'],
        columns: [{ propertyName: 'email', columnName: 'email', type: 'TEXT' } as ColumnMetadata],
        relationships: [],
        indexes: [
          {
            name: 'idx_unique_email',
            columns: ['email'],
            unique: true
          }
        ]
      };

      const indexes = builder.buildCreateIndexesSql(metadata);

      expect(indexes).toHaveLength(1);
      expect(indexes[0]).toContain('UNIQUE INDEX');
      expect(indexes[0]).toContain('idx_unique_email');
    });

    it('should forward only name/columns/unique (no WHERE support)', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn(() => 'CREATE TABLE test_table (id INTEGER)'),
        generateCreateIndexSql: jest.fn((tableName, index) => {
          const cols = index.columns.join(', ');
          // Note: DdlBuilder passes only { name, columns, unique }
          return `CREATE INDEX ${index.name} ON ${tableName} (${cols})`;
        })
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'test_table',
        primaryKeys: ['id'],
        columns: [{ propertyName: 'status', columnName: 'status', type: 'TEXT' } as ColumnMetadata],
        relationships: [],
        indexes: [
          {
            name: 'idx_active_only',
            columns: ['status'],
            unique: false,
            where: "status = 'active'"
          }
        ]
      };

      const indexes = builder.buildCreateIndexesSql(metadata);

      expect(indexes).toHaveLength(1);
      // WHERE is not forwarded by DdlBuilder per current public API
      expect(indexes[0]).not.toContain('WHERE');
      expect(strategy.generateCreateIndexSql).toHaveBeenCalledWith('test_table', {
        name: 'idx_active_only',
        columns: ['status'],
        unique: false
      });
    });
  });

  describe('buildAll comprehensive scenarios', () => {
    it('should generate complete DDL with table and all indexes', () => {
      const strategy: DdlStrategy = {
        generateCreateTableSql: jest.fn(
          () => 'CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)'
        ),
        generateCreateIndexSql: jest.fn(
          (tableName, index) =>
            `CREATE INDEX ${index.name} ON ${tableName} (${index.columns.join(', ')})`
        )
      };

      const builder = new DdlBuilder(strategy);
      const metadata: EntityMetadata = {
        entityClass: class TestEntity {},
        tableName: 'test_table',
        primaryKeys: ['id'],
        columns: [
          { propertyName: 'id', columnName: 'id', type: 'INTEGER' } as ColumnMetadata,
          { propertyName: 'name', columnName: 'name', type: 'TEXT' } as ColumnMetadata,
          { propertyName: 'email', columnName: 'email', type: 'TEXT' } as ColumnMetadata
        ],
        relationships: [],
        indexes: [
          { name: 'idx_name', columns: ['name'], unique: false },
          { name: 'idx_email', columns: ['email'], unique: true }
        ]
      };

      const result = builder.buildAll(metadata);

      expect(result.tableSql).toBe('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');
      expect(result.indexSqls).toHaveLength(2);
      expect(result.indexSqls[0]).toContain('idx_name');
      expect(result.indexSqls[1]).toContain('idx_email');
    });
  });
});
