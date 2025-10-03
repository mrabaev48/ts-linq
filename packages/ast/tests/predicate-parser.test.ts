import 'reflect-metadata';
import { PredicateParser } from '../src';

describe('PredicateParser', () => {
  it('parses simple equality', () => {
    const p: PredicateParser<{ id: number }> = new PredicateParser<{ id: number }>();
    const ast = p.parse((x: { id: number }) => x.id === 1);
    expect(ast).not.toBeNull();
  });
  it('parses conjunction with >= and >', () => {
    const p: PredicateParser<{ price: number; stock: number }> = new PredicateParser<{
      price: number;
      stock: number;
    }>();
    const ast = p.parse((x: { price: number; stock: number }) => x.price >= 10 && x.stock > 0);
    expect(ast).not.toBeNull();
  });
  it('returns null for variable comparison (fallback)', () => {
    const max = 10;
    const p: PredicateParser<{ price: number }> = new PredicateParser<{ price: number }>();
    const ast = p.parse((x: { price: number }) => x.price <= max);
    expect(ast).toBeNull();
  });
});
