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
const sqlite_1 = require('@ts-linq/sqlite');
const Entity_1 = require('../src/decorators/Entity');
const Column_1 = require('../src/decorators/Column');
const PrimaryKey_1 = require('../src/decorators/PrimaryKey');
const core_1 = require('@ts-linq/core');
let CUser = class CUser {};
__decorate(
  [(0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
  CUser.prototype,
  'id',
  void 0
);
__decorate(
  [(0, Column_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
  CUser.prototype,
  'name',
  void 0
);
CUser = __decorate([(0, Entity_1.Entity)({ name: 'C_Users' })], CUser);
describe('Provider contract (SQLite)', () => {
  let provider;
  beforeEach(async () => {
    // Ensure metadata registered
    core_1.MetadataStorage.getInstance().clear();
    core_1.MetadataStorage.addEntity(CUser, 'C_Users');
    core_1.MetadataStorage.addColumn(CUser, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    core_1.MetadataStorage.addColumn(CUser, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    core_1.MetadataStorage.addPrimaryKey(CUser, 'id');
    provider = new sqlite_1.SQLiteProvider(':memory:');
    await provider.connect();
    const meta = core_1.MetadataStorage.getEntity(CUser);
    expect(meta).toBeDefined();
    await provider.createTable(meta);
  });
  afterEach(async () => {
    await provider.disconnect();
  });
  test('CRUD: insert, findAll, update, delete', async () => {
    const u = new CUser();
    u.name = 'A';
    await provider.insert(u, CUser);
    expect(u.id).toBeGreaterThan(0);
    let all = await provider.findAll(CUser);
    expect(all.length).toBe(1);
    const first = all[0];
    first.name = 'B';
    await provider.update(first, CUser);
    all = await provider.findWhere(CUser, { name: 'B' });
    expect(all.length).toBe(1);
    await provider.delete(first, CUser);
    all = await provider.findAll(CUser);
    expect(all.length).toBe(0);
  });
  test('Upsert: insert then update on conflict', async () => {
    const u = new CUser();
    u.name = 'A';
    // first insert via upsert
    await provider.upsert(u, CUser);
    expect(u.id).toBeGreaterThan(0);
    // change and upsert should update
    u.name = 'B';
    await provider.upsert(u, CUser);
    const all = await provider.findWhere(CUser, { name: 'B' });
    expect(all.length).toBe(1);
  });
  test('Transactions: begin/commit/rollback state flags', async () => {
    expect(provider.inTransactionState).toBe(false);
    await provider.beginTransaction();
    expect(provider.inTransactionState).toBe(true);
    await provider.commitTransaction();
    expect(provider.inTransactionState).toBe(false);
    await provider.beginTransaction();
    expect(provider.inTransactionState).toBe(true);
    await provider.rollbackTransaction();
    expect(provider.inTransactionState).toBe(false);
  });
  test('Optimistic concurrency error type', async () => {
    const u = new CUser();
    u.name = 'A';
    await provider.insert(u, CUser);
    // prepare stale entity with wrong version by enabling version metadata retroactively
    const meta = core_1.MetadataStorage.getEntity(CUser);
    meta.columns.push({
      propertyName: 'version',
      columnName: 'version',
      type: 'INTEGER',
      nullable: false,
      isGenerated: false,
      isVersion: true
    });
    await provider.executeNonQuery(
      `ALTER TABLE ${meta.tableName} ADD COLUMN version INTEGER DEFAULT 0`
    );
    // stale update with version=5 that doesn't match 0
    u.version = 5;
    await expect(provider.update(u, CUser)).rejects.toThrow();
  });
});
//# sourceMappingURL=provider-contract.test.js.map
