import 'reflect-metadata';
import { PredicateParser } from '../src/query/PredicateParser';
import { ExpressionNode } from '../src/query/ast/Nodes';

describe('PredicateParser', () => {
    it('parses simple equality', () => {
        const p = new PredicateParser<any>();
        const ast = p.parse((x: any) => x.id === 1) as ExpressionNode;
        expect(ast).toBeTruthy();
    });
    it('parses conjunction with >= and >', () => {
        const p = new PredicateParser<any>();
        const ast = p.parse((x: any) => x.price >= 10 && x.stock > 0) as ExpressionNode;
        expect(ast).toBeTruthy();
    });
    it('returns null for variable comparison (fallback)', () => {
        const max = 10;
        const p = new PredicateParser<any>();
        const ast = p.parse((x: any) => x.price <= max);
        expect(ast).toBeNull();
    });
});


