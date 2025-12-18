import { CachePolicy, getCachePolicy } from '../src/CachePolicy';

describe('CachePolicy Decorator', () => {
  describe('getCachePolicy()', () => {
    it('should return undefined for class without policy', () => {
      class NoPolicy {}
      expect(getCachePolicy(NoPolicy)).toBeUndefined();
    });
  });

  describe('CachePolicy decorator (Stage-3)', () => {
    it('should throw when used with legacy decorators', () => {
      expect(() => {
        CachePolicy({ ttl: 60 })(class TestClass {});
      }).toThrow('@CachePolicy requires TS5 Stage-3 decorators');
    });

    it('should accept ttl option', () => {
      const decorator = CachePolicy({ ttl: 300 });
      expect(typeof decorator).toBe('function');
    });

    it('should accept invalidateOn option', () => {
      const decorator = CachePolicy({ 
        invalidateOn: ['User', 'Order'] 
      });
      expect(typeof decorator).toBe('function');
    });

    it('should accept combined options', () => {
      const decorator = CachePolicy({ 
        ttl: 120,
        invalidateOn: ['Product']
      });
      expect(typeof decorator).toBe('function');
    });
  });
});
