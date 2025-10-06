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
  let CUser = class CUser {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    CUser.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
    CUser.prototype,
    'name',
    void 0
  );
  CUser = __decorate([(0, src_1.Entity)()], CUser);
  return { CUser };
}
class CacheCtx extends src_1.DbContext {
  constructor() {
    super({
      provider: new ProviderStub_1.ProviderStub(':memory:'),
      connectionString: ':memory:',
      performance: { enableEntityCache: true, entityCacheSize: 100 }
    });
  }
}
describe('L2 Entity Cache', () => {
  let ctx;
  let CUser;
  beforeEach(async () => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    const e = defineEntity();
    CUser = e.CUser;
    ctx = new CacheCtx();
    await ctx.ensureCreated();
  });
  afterEach(async () => {
    await ctx.dispose();
  });
  it('caches entity on first load and returns same instance next time', async () => {
    const u = new CUser();
    u.name = 'A';
    ctx.set(CUser).add(u);
    await ctx.saveChanges();
    const first = await ctx.set(CUser).find(u.id);
    const second = await ctx.set(CUser).find(u.id);
    expect(first).toBe(second);
  });
  it('updates cache on update and invalidates on delete', async () => {
    const u = new CUser();
    u.name = 'A';
    ctx.set(CUser).add(u);
    await ctx.saveChanges();
    const first = await ctx.set(CUser).find(u.id);
    expect(first.name).toBe('A');
    // update
    first.name = 'B';
    ctx.set(CUser).update(first);
    await ctx.saveChanges();
    const afterUpdate = await ctx.set(CUser).find(u.id);
    expect(afterUpdate.name).toBe('B');
    expect(afterUpdate).toBe(first); // same instance updated in cache
    // delete
    ctx.set(CUser).remove(afterUpdate);
    await ctx.saveChanges();
    const afterDelete = await ctx.set(CUser).find(u.id);
    expect(afterDelete).toBeNull();
  });
});
//# sourceMappingURL=l2-cache.test.js.map
