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
const src_1 = require('../src');
const ProviderStub_1 = require('./_stubs/ProviderStub');
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
function defineEntity() {
  let TItem = class TItem {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    TItem.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
    TItem.prototype,
    'name',
    void 0
  );
  TItem = __decorate([(0, src_1.Entity)()], TItem);
  return { TItem };
}
class AppCtx extends src_1.DbContext {
  constructor() {
    super({
      connectionString: ':memory:',
      provider: new ProviderStub_1.ProviderStub(':memory:'),
      performance: {
        enableEntityCache: true,
        entityCacheSize: 100,
        enableCountCache: true,
        countCacheTtlMs: 60000
      }
    });
  }
}
describe('Transaction-aware cache invalidation', () => {
  let Item;
  beforeEach(() => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    const e = defineEntity();
    Item = e.TItem;
  });
  it('clears count() cache on commit', async () => {
    const ctx = new AppCtx();
    await ctx.ensureCreated();
    // seed: 1 row
    const a = new Item();
    a.name = 'A';
    ctx.set(Item).add(a);
    await ctx.saveChanges();
    const c1 = await ctx.set(Item).count(); // populate count cache => 1
    expect(c1).toBe(1);
    // begin tx, insert second row, then commit
    await ctx.beginTransaction();
    const b = new Item();
    b.name = 'B';
    ctx.set(Item).add(b);
    await ctx.saveChanges();
    await ctx.commitTransaction(); // should clear global count cache
    const c2 = await ctx.set(Item).count();
    expect(c2).toBe(2);
    await ctx.dispose();
  });
  it('clears L2 entity cache on rollback', async () => {
    const ctx = new AppCtx();
    await ctx.ensureCreated();
    const it = new Item();
    it.name = 'A';
    ctx.set(Item).add(it);
    await ctx.saveChanges();
    // materialize to populate L2 cache
    const first = await ctx.set(Item).first();
    expect(first.name).toBe('A');
    // update within tx, then rollback
    await ctx.beginTransaction();
    first.name = 'B';
    ctx.set(Item).update(first);
    await ctx.saveChanges();
    await ctx.rollbackTransaction(); // should clear L2 cache
    const after = await ctx.set(Item).first();
    expect(after.name).toBe('A'); // not the stale 'B'
    await ctx.dispose();
  });
});
//# sourceMappingURL=cache-transaction-invalidation.test.js.map
