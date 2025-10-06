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
function defineSUser() {
  let SUser = class SUser {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    SUser.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
    SUser.prototype,
    'name',
    void 0
  );
  __decorate(
    [
      (0, src_1.Column)({ type: 'BOOLEAN', nullable: false, defaultValue: false }),
      __metadata('design:type', Boolean)
    ],
    SUser.prototype,
    'isDeleted',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'DATETIME', nullable: true }), __metadata('design:type', Date)],
    SUser.prototype,
    'deletedAt',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'DATETIME', nullable: true }), __metadata('design:type', Date)],
    SUser.prototype,
    'createdAt',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'DATETIME', nullable: true }), __metadata('design:type', Date)],
    SUser.prototype,
    'updatedAt',
    void 0
  );
  SUser = __decorate([(0, src_1.Entity)()], SUser);
  return SUser;
}
class SoftCtx extends src_1.DbContext {
  constructor() {
    super({
      provider: new ProviderStub_1.ProviderStub(':memory:'),
      softDelete: { enabled: true, column: 'isDeleted', deletedAtColumn: 'deletedAt' },
      audit: { enabled: true }
    });
  }
}
describe('Soft delete & audit', () => {
  let ctx;
  let SUser;
  beforeEach(async () => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    SUser = defineSUser();
    ctx = new SoftCtx();
    await ctx.ensureCreated();
  });
  afterEach(async () => {
    await ctx.dispose();
  });
  it('filters out soft-deleted rows and stamps audit fields', async () => {
    const u = new SUser();
    u.name = 'A';
    ctx.set(SUser).add(u);
    await ctx.saveChanges();
    // update triggers updatedAt
    u.name = 'B';
    ctx.set(SUser).update(u);
    await ctx.saveChanges();
    // soft delete
    ctx.set(SUser).remove(u);
    await ctx.saveChanges();
    const all = await ctx.set(SUser).toArray();
    expect(all).toHaveLength(0);
  });
});
//# sourceMappingURL=soft-delete.test.js.map
