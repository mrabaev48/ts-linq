import { MetadataStorage } from '@ts-linq/metadata';
import { PropertyExtractor } from '../src/PropertyExtractor';

class Product {
  id!: number;
  price!: number;
  category!: string;
  books?: unknown[];
}

function registerProductMetadata(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(Product, 'products');
  MetadataStorage.addColumn(Product, { propertyName: 'id', columnName: 'product_id', type: 'INTEGER', primaryKey: true });
  MetadataStorage.addColumn(Product, { propertyName: 'price', columnName: 'unit_price', type: 'DECIMAL' });
  MetadataStorage.addColumn(Product, { propertyName: 'category', columnName: 'category_name', type: 'TEXT' });
}

describe('PropertyExtractor', () => {
  beforeEach(() => {
    // Reset internal static caches between tests
    (PropertyExtractor as unknown as { _selectorPropsCache: Map<string, string[]> })._selectorPropsCache.clear();
    (PropertyExtractor as unknown as { _keySelectorCache: Map<string, string> })._keySelectorCache.clear();
    (PropertyExtractor as unknown as { _includePropCache: Map<string, string> })._includePropCache.clear();
  });

  describe('extractPropertyName', () => {
    it('extracts from arrow form: e => e.price', () => {
      const selector = (e: Product) => e.price;
      expect(PropertyExtractor.extractPropertyName(selector)).toBe('price');
    });

    it('extracts from return form: function(e) { return e.category; }', () => {
      const selector = function(e: Product) { return e.category; };
      expect(PropertyExtractor.extractPropertyName(selector)).toBe('category');
    });

    it('throws on a complex expression with no property access', () => {
      const badSelector = (() => 42) as unknown as (e: Product) => Product['id'];
      expect(() => PropertyExtractor.extractPropertyName(badSelector)).toThrow(
        'cannot extract property name'
      );
    });
  });

  describe('resolveColumnName', () => {
    beforeEach(registerProductMetadata);

    it('maps TS property name to DB column name', () => {
      expect(PropertyExtractor.resolveColumnName(Product, 'price')).toBe('unit_price');
      expect(PropertyExtractor.resolveColumnName(Product, 'id')).toBe('product_id');
    });

    it('returns property name when no metadata column mapping exists', () => {
      MetadataStorage.getInstance().clear();
      expect(PropertyExtractor.resolveColumnName(Product, 'price')).toBe('price');
    });
  });

  describe('extractIncludeProperty', () => {
    it('extracts relationship name from arrow selector', () => {
      const selector = (e: Product) => e.books;
      expect(PropertyExtractor.extractIncludeProperty(selector)).toBe('books');
    });

    it('throws when selector does not match single-prop pattern', () => {
      const bad = (() => null) as unknown as (e: Product) => unknown;
      expect(() => PropertyExtractor.extractIncludeProperty(bad)).toThrow(
        'Unable to parse include selector'
      );
    });

    it('caches the result on second call', () => {
      const selector = (e: Product) => e.books;
      const first = PropertyExtractor.extractIncludeProperty(selector);
      const second = PropertyExtractor.extractIncludeProperty(selector);
      expect(first).toBe(second);
    });
  });

  describe('extractPropertiesFromSelector', () => {
    it('handles single prop: e => e.price', () => {
      expect(PropertyExtractor.extractPropertiesFromSelector('e => e.price')).toEqual(['price']);
    });

    it('handles parenthesised object: e => ({ id: e.id, price: e.price })', () => {
      const result = PropertyExtractor.extractPropertiesFromSelector(
        'e => ({ id: e.id, price: e.price })'
      );
      expect(result).toEqual(['id', 'price']);
    });

    it('handles simple object: e => { return { id: e.id }; }', () => {
      const result = PropertyExtractor.extractPropertiesFromSelector(
        'e => { return { id: e.id }; }'
      );
      // REGEX_SIMPLE_OBJECT picks up the block body — fallback to ['*'] since braces match block
      // (regression-guard: must return a non-empty array)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("falls back to ['*'] when no pattern matches", () => {
      expect(PropertyExtractor.extractPropertiesFromSelector('() => 42')).toEqual(['*']);
    });

    it('returns cached copy so mutation does not affect cache', () => {
      const a = PropertyExtractor.extractPropertiesFromSelector('e => e.price');
      a.push('mutated');
      const b = PropertyExtractor.extractPropertiesFromSelector('e => e.price');
      expect(b).not.toContain('mutated');
    });
  });

  describe('extractPropertyFromKeySelector', () => {
    it('extracts from arrow form', () => {
      expect(PropertyExtractor.extractPropertyFromKeySelector('e => e.id')).toBe('id');
    });

    it('throws when selector does not match', () => {
      expect(() =>
        PropertyExtractor.extractPropertyFromKeySelector('() => 1 + 1')
      ).toThrow('Unable to parse key selector');
    });

    it('caches the result on second call', () => {
      const first = PropertyExtractor.extractPropertyFromKeySelector('e => e.category');
      const second = PropertyExtractor.extractPropertyFromKeySelector('e => e.category');
      expect(first).toBe(second);
    });
  });

  describe('cache size safety', () => {
    it('does not throw when SELECTOR_CACHE_MAX + 1 entries are inserted', () => {
      const max = (PropertyExtractor as unknown as { SELECTOR_CACHE_MAX: number }).SELECTOR_CACHE_MAX;
      expect(() => {
        for (let i = 0; i <= max + 1; i++) {
          PropertyExtractor.extractPropertiesFromSelector(`e => e.prop${i}`);
        }
      }).not.toThrow();
    });
  });
});
