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
function defineE() {
  let MW = class MW {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    MW.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
    MW.prototype,
    'name',
    void 0
  );
  MW = __decorate([(0, src_1.Entity)()], MW);
  return { MW };
}
class MWCtx extends src_1.DbContext {
  constructor(middlewares) {
    const { ProviderStub } = require('./_stubs/ProviderStub');
    super({
      provider: new ProviderStub(':memory:', undefined, middlewares),
      connectionString: ':memory:'
    });
  }
}
describe('Middleware entityMaterialized hook', () => {
  beforeEach(() => MetadataStorage_1.MetadataStorage.getInstance().clear());
  it('fires entityMaterialized for each materialized row', async () => {
    const { MW } = defineE();
    const seen = [];
    const mw = {
      entityMaterialized: async ({ entity }) => {
        seen.push(entity);
      }
    };
    const ctx = new MWCtx([mw]);
    await ctx.ensureCreated();
    const a = new MW();
    a.name = 'A';
    ctx.set(MW).add(a);
    const b = new MW();
    b.name = 'B';
    ctx.set(MW).add(b);
    await ctx.saveChanges();
    const rows = await ctx
      .set(MW)
      .orderBy((x) => x.id)
      .toArray();
    expect(rows).toHaveLength(2);
    // entityMaterialized может быть асинхронным — подождём микротаск-тик
    await new Promise((res) => setTimeout(res, 0));
    expect(seen.map((e) => e.name).sort()).toEqual(['A', 'B']);
    await ctx.dispose();
  });
});
//# sourceMappingURL=middleware-entity-materialized.test.js.map
