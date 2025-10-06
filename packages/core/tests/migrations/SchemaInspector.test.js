'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const DatabaseProvider_1 = require('../../src/DatabaseProvider');
const SchemaInspector_1 = require('../../src/migrations/SchemaInspector');
class FakeProvider extends DatabaseProvider_1.DatabaseProvider {
  constructor(responses) {
    super('');
    this.responses = responses;
  }
  async connect() {}
  async disconnect() {}
  async createTable() {}
  getDialect() {
    return {};
  }
  async insert(entity) {
    return entity;
  }
  async update(entity) {
    return entity;
  }
  async delete() {}
  async findById() {
    return null;
  }
  async findAll() {
    return [];
  }
  async findWhere() {
    return [];
  }
  async findWhereIn() {
    return [];
  }
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
  async doExecuteQuery(sql, _params) {
    const hit = this.responses.find((r) => r.sqlLike.test(sql));
    return hit?.rows || [];
  }
  async doExecuteNonQuery() {
    return 0;
  }
}
test('PostgresSchemaInspector.getIndexes parses unique, columns and where', async () => {
  const provider = new FakeProvider([
    {
      sqlLike: /FROM\s+pg_indexes/i,
      rows: [
        {
          indexname: 'idx_users_active',
          indexdef:
            'CREATE INDEX idx_users_active ON public."Users" ("active") WHERE (active = true)'
        },
        {
          indexname: 'idx_users_lower_email',
          indexdef: 'CREATE UNIQUE INDEX idx_users_lower_email ON public."Users" (LOWER((email)))'
        }
      ]
    }
  ]);
  const ins = new SchemaInspector_1.PostgresSchemaInspector(provider);
  const idx = await ins.getIndexes('Users');
  expect(idx.find((i) => i.name === 'idx_users_active')?.where ?? '').toContain('active');
  expect(idx.find((i) => i.name === 'idx_users_lower_email')?.unique).toBe(true);
  expect(idx[0].columns).toContain('active');
});
test('MySqlSchemaInspector.getIndexes aggregates by name and preserves column order', async () => {
  const provider = new FakeProvider([
    {
      sqlLike: /FROM\s+information_schema\.statistics/i,
      rows: [
        {
          INDEX_NAME: 'idx_users_email',
          NON_UNIQUE: 0,
          COLUMN_NAME: 'email',
          SEQ_IN_INDEX: 1,
          COLLATION: 'A',
          EXPRESSION: null
        },
        {
          INDEX_NAME: 'idx_users_email',
          NON_UNIQUE: 0,
          COLUMN_NAME: null,
          SEQ_IN_INDEX: 2,
          COLLATION: 'A',
          EXPRESSION: 'LOWER(`email`)'
        }
      ]
    }
  ]);
  const ins = new SchemaInspector_1.MySqlSchemaInspector(provider);
  const idx = await ins.getIndexes('Users');
  expect(idx[0].name).toBe('idx_users_email');
  expect(idx[0].unique).toBe(true);
  expect(idx[0].columns).toEqual(['email']);
});
test('MssqlSchemaInspector.getIndexes returns where and columns', async () => {
  const provider = new FakeProvider([
    {
      sqlLike: /sys\.index_columns/i,
      rows: [
        {
          index_name: 'idx_users_active',
          column_name: 'active',
          key_ordinal: 1,
          is_descending_key: 0
        }
      ]
    },
    {
      sqlLike: /FROM\s+sys\.indexes/i,
      rows: [{ name: 'idx_users_active', is_unique: 0, filter_definition: '([active]=(1))' }]
    }
  ]);
  const ins = new SchemaInspector_1.MssqlSchemaInspector(provider);
  const idx = await ins.getIndexes('Users');
  expect(idx[0].name).toBe('idx_users_active');
  expect(idx[0].where).toContain('active');
  const cols = idx.find((i) => i.name === 'idx_users_active')?.columns ?? [];
  expect(cols).toEqual(['active']);
});
//# sourceMappingURL=SchemaInspector.test.js.map
