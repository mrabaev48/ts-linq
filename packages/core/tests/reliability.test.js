'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const DatabaseProvider_1 = require('../src/DatabaseProvider');
const PredicateParser_1 = require('../src/query/PredicateParser');
describe('Reliability & Errors', () => {
  test('SqlLogger receives start/end with timings and optional error', async () => {
    const events = [];
    const logger = {
      queryStart: (i) => events.push({ t: 'start', ...i }),
      queryEnd: (i) => events.push({ t: 'end', ...i })
    };
    class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
      async connect() {}
      async disconnect() {}
      async createTable() {}
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
        if (sql.includes('FAIL')) throw new Error('boom');
        return [{ ok: true }];
      }
      async doExecuteNonQuery() {
        return 1;
      }
      async beginTransaction() {}
      async commitTransaction() {}
      async rollbackTransaction() {}
      constructor() {
        super('memory', logger);
      }
    }
    const provider = new ProviderStub();
    const rows = await provider.executeQuery('SELECT 1', [1]);
    expect(rows.length).toBe(1);
    expect(events[0].t).toBe('start');
    expect(events[1].t).toBe('end');
    expect(typeof events[1].durationMs).toBe('number');
    events.length = 0;
    await expect(provider.executeQuery('FAIL', [])).rejects.toThrow('boom');
    expect(events[0].t).toBe('start');
    expect(events[1].t).toBe('end');
    expect(events[1].error).toBeInstanceOf(Error);
  });
  test('PredicateParser guard rails produce null for complex predicates', () => {
    const parser = new PredicateParser_1.PredicateParser();
    const complex = (a) => {
      const x = a.price > 10 || a.stock > 0;
      return x;
    };
    const res = parser.parse(complex);
    expect(res).toBeNull();
  });
});
//# sourceMappingURL=reliability.test.js.map
