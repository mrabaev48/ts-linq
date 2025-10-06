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
const DbContext_1 = require('../src/context/DbContext');
const ProviderStub_1 = require('./_stubs/ProviderStub');
const Entity_1 = require('../src/decorators/Entity');
const PrimaryKey_1 = require('../src/decorators/PrimaryKey');
const Column_1 = require('../src/decorators/Column');
const Relationships_1 = require('../src/decorators/Relationships');
let PerfAuthor = class PerfAuthor {};
__decorate(
  [(0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
  PerfAuthor.prototype,
  'id',
  void 0
);
__decorate(
  [(0, Column_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
  PerfAuthor.prototype,
  'name',
  void 0
);
__decorate(
  [
    (0, Relationships_1.OneToMany)(() => PerfBook, { foreignKey: 'authorId' }),
    __metadata('design:type', Array)
  ],
  PerfAuthor.prototype,
  'books',
  void 0
);
PerfAuthor = __decorate([(0, Entity_1.Entity)({ name: 'PerfAuthors' })], PerfAuthor);
let PerfBook = class PerfBook {};
__decorate(
  [(0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }), __metadata('design:type', Number)],
  PerfBook.prototype,
  'id',
  void 0
);
__decorate(
  [(0, Column_1.Column)({ type: 'TEXT', nullable: false }), __metadata('design:type', String)],
  PerfBook.prototype,
  'title',
  void 0
);
__decorate(
  [(0, Column_1.Column)({ type: 'INTEGER', nullable: false }), __metadata('design:type', Number)],
  PerfBook.prototype,
  'authorId',
  void 0
);
__decorate(
  [
    (0, Relationships_1.ManyToOne)(() => PerfAuthor, { foreignKey: 'authorId' }),
    __metadata('design:type', PerfAuthor)
  ],
  PerfBook.prototype,
  'author',
  void 0
);
PerfBook = __decorate([(0, Entity_1.Entity)({ name: 'PerfBooks' })], PerfBook);
class PerfCtx extends DbContext_1.DbContext {
  constructor(logger) {
    super({
      connectionString: ':memory:',
      provider: new ProviderStub_1.ProviderStub(':memory:', logger),
      logger
    });
  }
}
describe('Include batching performance', () => {
  test('one-to-many include is batched into a single IN query (no N+1)', async () => {
    const events = [];
    const logger = {
      queryStart: (i) => events.push({ t: 'start', ...i }),
      queryEnd: (i) => events.push({ t: 'end', ...i })
    };
    // Ensure decorators are applied
    new PerfAuthor();
    new PerfBook();
    const ctx = new PerfCtx(logger);
    await ctx.ensureCreated();
    // Seed 10 authors + 10 books
    for (let i = 0; i < 10; i++) {
      const a = new PerfAuthor();
      a.name = `A${i}`;
      ctx.set(PerfAuthor).add(a);
      await ctx.saveChanges();
      const b = {
        title: `B${i}`,
        authorId: a.id
      };
      ctx.set(PerfBook).add(b);
      await ctx.saveChanges();
    }
    // Reset logger events before the measured query
    events.length = 0;
    // Run include query expected to batch
    const authors = await ctx
      .set(PerfAuthor)
      .include((a) => a.books)
      .toArray();
    expect(authors.length).toBe(10);
    // Count SELECT statements during the measured operation
    const starts = events.filter((e) => e.t === 'start' && /^SELECT/i.test(e.sql || '')).length;
    // Expect 2 selects: one for authors, one batched IN for books
    expect(starts).toBe(2);
    await ctx.dispose();
  });
});
//# sourceMappingURL=include-batching-perf.test.js.map
