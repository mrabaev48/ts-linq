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
const MetadataStorage_1 = require('../src/metadata/MetadataStorage');
function defineB() {
  let BUser = class BUser {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    BUser.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
    BUser.prototype,
    'name',
    void 0
  );
  BUser = __decorate([(0, src_1.Entity)()], BUser);
  return { BUser };
}
class BCtx extends src_1.DbContext {
  constructor() {
    const { ProviderStub } = require('./_stubs/ProviderStub');
    super({ provider: new ProviderStub(':memory:') });
  }
}
describe('Batch operations using base provider', () => {
  let BUser;
  beforeEach(async () => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    const e = defineB();
    BUser = e.BUser;
  });
  it('insertMany and updateMany work in a transaction', async () => {
    const ctx = new BCtx();
    await ctx.ensureCreated();
    const users = Array.from({ length: 5 }, (_, i) => {
      const u = new BUser();
      u.name = `U${i + 1}`;
      return u;
    });
    await expect(ctx.set(BUser).insertMany(users)).resolves.toHaveLength(5);
    // mutate
    users.forEach((u) => (u.name = `${u.name}!`));
    await expect(ctx.set(BUser).updateMany(users)).resolves.toHaveLength(5);
    const rows = await ctx
      .set(BUser)
      .orderBy((x) => x.id)
      .toArray();
    expect(rows.map((r) => r.name)).toEqual(['U1!', 'U2!', 'U3!', 'U4!', 'U5!']);
    await ctx.dispose();
  });
});
//# sourceMappingURL=batch-operations.test.js.map
