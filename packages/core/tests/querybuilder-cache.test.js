"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const QueryBuilder_1 = require("../src/query/QueryBuilder");
class DummyDialect {
    buildSelect(entityClass, _options) {
        return { query: `SELECT * FROM ${entityClass.name}`, parameters: [] };
    }
}
class CapturingLogger {
    constructor() {
        this.cacheCalls = [];
    }
    cache(info) {
        this.cacheCalls.push(info);
    }
}
class User {
}
describe('QueryBuilder cache metrics', () => {
    it('emits cache miss then hit for the same options', () => {
        const logger = new CapturingLogger();
        const qb = new QueryBuilder_1.QueryBuilder(new DummyDialect(), logger, 'sqlite');
        const opts = { select: ['*'] };
        const a = qb.generateSql(User, opts);
        const b = qb.generateSql(User, opts);
        expect(a.query).toBe(b.query);
        const hasMiss = logger.cacheCalls.some((c) => c.cache === 'sqlGen' && c.hit === false);
        const hasHit = logger.cacheCalls.some((c) => c.cache === 'sqlGen' && c.hit === true);
        expect(hasMiss).toBe(true);
        expect(hasHit).toBe(true);
    });
});
require("reflect-metadata");
class DialectStub {
    constructor() {
        this.calls = 0;
    }
    buildSelect(entityClass, options) {
        this.calls++;
        return { query: 'SELECT x', parameters: [] };
    }
}
describe('QueryBuilder cache', () => {
    beforeEach(() => QueryBuilder_1.QueryBuilder.clearCache());
    test('clearCache forces regeneration', () => {
        class E {
        }
        const d = new DialectStub();
        const qb = new QueryBuilder_1.QueryBuilder(d);
        const opts = {};
        qb.generateSql(E, opts);
        expect(d.calls).toBe(1);
        qb.generateSql(E, opts);
        expect(d.calls).toBe(1); // cached
        QueryBuilder_1.QueryBuilder.clearCache();
        qb.generateSql(E, opts);
        expect(d.calls).toBe(2);
    });
});
//# sourceMappingURL=querybuilder-cache.test.js.map