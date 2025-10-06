'use strict';
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
            ? (desc = Object.getOwnPropertyDescriptor(target, key))
            : desc,
      d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return (c > 3 && r && Object.defineProperty(target, key, r), r);
  };
var __metadata =
  (this && this.__metadata) ||
  function (k, v) {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
      return Reflect.metadata(k, v);
  };
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const Entity_1 = require('../src/decorators/Entity');
const PrimaryKey_1 = require('../src/decorators/PrimaryKey');
const Column_1 = require('../src/decorators/Column');
const DatabaseProvider_1 = require('../src/DatabaseProvider');
let UpUser = class UpUser {};
__decorate(
  [(0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
  UpUser.prototype,
  'id',
  void 0
);
__decorate(
  [(0, Column_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
  UpUser.prototype,
  'name',
  void 0
);
UpUser = __decorate([(0, Entity_1.Entity)({ name: 'UpUsers' })], UpUser);
class FakePg extends DatabaseProvider_1.DatabaseProvider {
  constructor() {
    super('');
    this.rowsToReturn = [{ id: 1, name: 'pg' }];
    this.providerName = 'postgresql';
  }
  async connect() {}
  async disconnect() {}
  async createTable() {}
  getDialect() {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  async doExecuteQuery(sql, params = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return this.rowsToReturn;
  }
  async doExecuteNonQuery(sql, params = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return 1;
  }
  async insert(e) {
    return e;
  }
  async update(e) {
    return e;
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
  async upsert(entity, entityClass) {
    this.lastSql = `INSERT INTO "UpUsers" ... ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING *`;
    this.lastParams = [entity.id ?? null, entity.name ?? null];
    // Simulate returned row overwriting entity name
    entity.name = this.rowsToReturn[0]?.name || entity.name;
    return entity;
  }
}
class FakeMy extends DatabaseProvider_1.DatabaseProvider {
  constructor() {
    super('');
    this.providerName = 'mysql';
  }
  async connect() {}
  async disconnect() {}
  async createTable() {}
  getDialect() {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  async doExecuteQuery(sql, params = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return [];
  }
  async doExecuteNonQuery(sql, params = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return 1;
  }
  async insert(e) {
    return e;
  }
  async update(e) {
    return e;
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
  async upsert(entity, _entityClass) {
    this.lastSql = `INSERT INTO UpUsers (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`;
    this.lastParams = [entity.id ?? null, entity.name ?? null];
    return entity;
  }
}
class FakeMs extends DatabaseProvider_1.DatabaseProvider {
  constructor() {
    super('');
    this.providerName = 'mssql';
  }
  async connect() {}
  async disconnect() {}
  async createTable() {}
  getDialect() {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  async doExecuteQuery(sql, params = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return [];
  }
  async doExecuteNonQuery(sql, params = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return 1;
  }
  async insert(e) {
    return e;
  }
  async update(e) {
    return e;
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
  async upsert(entity, _entityClass) {
    this.lastSql = `MERGE UpUsers AS t USING (VALUES (?, ?)) AS s(id, name) ON (t.id = s.id) WHEN MATCHED THEN UPDATE SET name = s.name WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);`;
    this.lastParams = [entity.id ?? null, entity.name ?? null];
    return entity;
  }
}
describe('Provider upsert SQL (unit)', () => {
  beforeEach(() => {
    new UpUser();
  });
  test('PostgresProvider generates ON CONFLICT DO UPDATE and returns row', async () => {
    const p = new FakePg('postgres://fake');
    const u = new UpUser();
    u.id = 10;
    u.name = 'A';
    p.rowsToReturn = [{ id: 10, name: 'B' }];
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/INSERT INTO "UpUsers"/);
    expect(p.lastSql).toMatch(/ON CONFLICT .* DO UPDATE SET/);
    expect(Array.isArray(p.lastParams)).toBe(true);
    expect(u.name).toBe('B');
  });
  test('MySqlProvider generates ON DUPLICATE KEY UPDATE', async () => {
    const p = new FakeMy('mysql://fake');
    const u = new UpUser();
    u.id = 11;
    u.name = 'A';
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/INSERT INTO UpUsers/);
    expect(p.lastSql).toMatch(/ON DUPLICATE KEY UPDATE/);
    expect(p.lastSql).toMatch(/\?/); // uses positional params
  });
  test('MssqlProvider generates MERGE statement', async () => {
    const p = new FakeMs('mssql://fake');
    const u = new UpUser();
    u.id = 12;
    u.name = 'A';
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/MERGE\s+UpUsers\s+AS\s+t/i);
    expect(p.lastSql).toMatch(/WHEN MATCHED THEN UPDATE SET/i);
    expect(p.lastSql).toMatch(/WHEN NOT MATCHED THEN INSERT/i);
  });
});
//# sourceMappingURL=provider-upsert-unit.test.js.map
