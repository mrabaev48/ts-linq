"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const composite_sql_logger_1 = require("composite-sql-logger");
describe('CompositeSqlLogger', () => {
    test('fan-outs queryStart/queryEnd/retry/transaction/cache to all delegates', () => {
        const calls = [];
        const makeLogger = (id) => ({
            queryStart: () => calls.push(`${id}:qs`),
            queryEnd: () => calls.push(`${id}:qe`),
            retry: () => calls.push(`${id}:r`),
            transactionStart: () => calls.push(`${id}:ts`),
            transactionEnd: () => calls.push(`${id}:te`),
            cache: (i) => calls.push(`${id}:c:${i.cache}:${i.hit ? 'H' : 'M'}`)
        });
        const c = new composite_sql_logger_1.CompositeSqlLogger(makeLogger('A'), makeLogger('B'));
        c.queryStart({ sql: 'SELECT 1', params: [] });
        c.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 5 });
        c.retry({ sql: 'SELECT 1', params: [], attempt: 1 });
        c.transactionStart({});
        c.transactionEnd({});
        c.cache({ cache: 'sqlGen', hit: true });
        expect(calls).toEqual([
            'A:qs',
            'B:qs',
            'A:qe',
            'B:qe',
            'A:r',
            'B:r',
            'A:ts',
            'B:ts',
            'A:te',
            'B:te',
            'A:c:sqlGen:H',
            'B:c:sqlGen:H'
        ]);
    });
    test('swallows delegate errors', () => {
        const ok = { queryStart: jest.fn() };
        const bad = {
            queryStart: () => {
                throw new Error('boom');
            }
        };
        const c = new composite_sql_logger_1.CompositeSqlLogger(bad, ok);
        expect(() => c.queryStart({ sql: 'SELECT 1', params: [] })).not.toThrow();
        expect(ok.queryStart.mock.calls.length).toBe(1);
    });
});
describe('CompositeSqlLoggerFactory', () => {
    test('composes results from factories and static loggers', () => {
        const lA = { queryStart: jest.fn() };
        const lB = { queryStart: jest.fn() };
        const f1 = { create: (p) => (p === 'sqlite' ? lA : undefined) };
        const f2 = { create: () => lB };
        const staticL = { queryEnd: jest.fn() };
        const factory = new composite_sql_logger_1.CompositeSqlLoggerFactory({ factories: [f1, f2], loggers: [staticL] });
        const comp = factory.create('sqlite');
        expect(comp).toBeTruthy();
        comp.queryStart?.({ sql: 'SELECT 1', params: [] });
        comp.queryEnd?.({ sql: 'SELECT 1', params: [], durationMs: 1 });
        expect(lA.queryStart.mock.calls.length).toBe(1);
        expect(lB.queryStart.mock.calls.length).toBe(1);
        expect(staticL.queryEnd.mock.calls.length).toBe(1);
    });
    test('returns undefined when no delegates found', () => {
        const factory = new composite_sql_logger_1.CompositeSqlLoggerFactory();
        const comp = factory.create('postgresql');
        expect(comp).toBeUndefined();
    });
});
//# sourceMappingURL=composite-logger.test.js.map