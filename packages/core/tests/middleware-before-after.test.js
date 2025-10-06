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
function defineBM() {
  let MWB = class MWB {};
  __decorate(
    [(0, src_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
    MWB.prototype,
    'id',
    void 0
  );
  __decorate(
    [(0, src_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
    MWB.prototype,
    'name',
    void 0
  );
  MWB = __decorate([(0, src_1.Entity)()], MWB);
  return { MWB };
}
class MWCtx2 extends src_1.DbContext {
  constructor(middlewares) {
    const provider = new ProviderStub_1.ProviderStub(':memory:', undefined, middlewares);
    super({ provider, connectionString: ':memory:' });
  }
}
describe('Middleware beforeExecute/afterExecute', () => {
  beforeEach(() => MetadataStorage_1.MetadataStorage.getInstance().clear());
  it('fires before and after for queries and non-queries with traceId/rows', async () => {
    const { MWB } = defineBM();
    const before = [];
    const after = [];
    const seenTraceIds = [];
    const seenRows = [];
    const mw = {
      beforeExecute: async (info) => {
        before.push(info.sql);
        seenTraceIds.push(info.traceId);
      },
      afterExecute: async (info) => {
        after.push(info.sql);
        seenTraceIds.push(info.traceId);
        seenRows.push(info.rows);
      }
    };
    const ctx = new MWCtx2([mw]);
    await ctx.ensureCreated();
    // откроем и закроем транзакцию для генерации traceId
    await ctx.beginTransaction();
    await ctx.commitTransaction();
    const a = new MWB();
    a.name = 'A';
    ctx.set(MWB).add(a);
    await ctx.saveChanges();
    await ctx.set(MWB).toArray();
    expect(before.length).toBeGreaterThanOrEqual(2);
    expect(after.length).toBeGreaterThanOrEqual(2);
    expect(seenTraceIds.some((id) => typeof id === 'string')).toBe(true);
    expect(seenRows.some((r) => typeof r === 'number')).toBe(true);
    await ctx.dispose();
  });
});
//# sourceMappingURL=middleware-before-after.test.js.map
