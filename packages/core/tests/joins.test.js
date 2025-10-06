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
const Column_1 = require('../src/decorators/Column');
const PrimaryKey_1 = require('../src/decorators/PrimaryKey');
const Queryable_1 = require('../src/query/Queryable');
const DatabaseProvider_1 = require('../src/DatabaseProvider');
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
let Author = class Author {};
__decorate(
  [(0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
  Author.prototype,
  'id',
  void 0
);
__decorate(
  [(0, Column_1.Column)({ type: 'TEXT' }), __metadata('design:type', String)],
  Author.prototype,
  'name',
  void 0
);
Author = __decorate([(0, Entity_1.Entity)({ name: 'Authors' })], Author);
let Book = class Book {};
__decorate(
  [(0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
  Book.prototype,
  'id',
  void 0
);
__decorate(
  [(0, Column_1.Column)({ type: 'TEXT' }), __metadata('design:type', String)],
  Book.prototype,
  'title',
  void 0
);
__decorate(
  [(0, Column_1.Column)({ type: 'INTEGER' }), __metadata('design:type', Number)],
  Book.prototype,
  'authorId',
  void 0
);
Book = __decorate([(0, Entity_1.Entity)({ name: 'Books' })], Book);
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
  async connect() {}
  async disconnect() {}
  async createTable() {}
  getDialect() {
    return {
      buildSelect: (ctor, opts) => {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
        const table = meta?.tableName ?? ctor.name;
        let q = `SELECT * FROM ${table}`;
        if (opts?.joins?.length) {
          for (const j of opts.joins) q += ` ${j.type} JOIN ${j.table} ON ${j.on}`;
        }
        return { query: q, parameters: [] };
      }
    };
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
  async doExecuteQuery(sql, params) {
    this.lastSql = sql;
    return [];
  }
  async doExecuteNonQuery(sql, params) {
    this.lastSql = sql;
    return 0;
  }
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
  constructor() {
    super('memory');
    this.lastSql = null;
  }
}
describe('JOIN generation', () => {
  test('innerJoin emits proper JOIN clause', async () => {
    const provider = new ProviderStub();
    // Instantiate to ensure metadata decoration
    new Author();
    new Book();
    const q = new Queryable_1.Queryable(Author, provider);
    await q.innerJoin(Book, (a, b) => a.id === b.authorId).toArray();
    expect(provider.lastSql).toContain('FROM Authors');
    expect(provider.lastSql).toContain('INNER JOIN Books');
    expect(provider.lastSql).toContain('Authors.id = Books.authorId');
  });
  test('leftJoin emits proper JOIN clause', async () => {
    const provider = new ProviderStub();
    new Author();
    new Book();
    const q = new Queryable_1.Queryable(Author, provider);
    await q.leftJoin(Book, (a, b) => a.id === b.authorId).toArray();
    expect(provider.lastSql).toContain('LEFT JOIN Books');
  });
});
//# sourceMappingURL=joins.test.js.map
