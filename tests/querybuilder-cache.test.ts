import 'reflect-metadata';
import { QueryBuilder } from '../src/query/QueryBuilder';
import { SqlDialect } from '../src/query/SqlDialect';
import { QueryOptions } from '../src/types';

class DialectStub implements SqlDialect {
    public calls = 0;
    buildSelect<T>(entityClass: new () => T, options: QueryOptions) {
        this.calls++;
        return { query: 'SELECT x', parameters: [] as any[] };
    }
}

describe('QueryBuilder cache', () => {
    beforeEach(() => QueryBuilder.clearCache());

    test('clearCache forces regeneration', () => {
        class E {}
        const d = new DialectStub();
        const qb = new QueryBuilder(d);
        const opts: QueryOptions = {};
        qb.generateSql(E, opts);
        expect(d.calls).toBe(1);
        qb.generateSql(E, opts);
        expect(d.calls).toBe(1); // cached
        QueryBuilder.clearCache();
        qb.generateSql(E, opts);
        expect(d.calls).toBe(2);
    });
});


