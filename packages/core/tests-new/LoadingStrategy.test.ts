import { LoadingStrategy } from '../src/loading/LoadingStrategy';

describe('LoadingStrategy', () => {
  describe('enum values', () => {
    it('should have Lazy strategy', () => {
      expect(LoadingStrategy.Lazy).toBeDefined();
    });

    it('should have Eager strategy', () => {
      expect(LoadingStrategy.Eager).toBeDefined();
    });

    it('should have distinct values for each strategy', () => {
      expect(LoadingStrategy.Lazy).not.toBe(LoadingStrategy.Eager);
    });
  });

  describe('strategy usage', () => {
    it('should work in switch statements', () => {
      const testStrategy = (strategy: LoadingStrategy): string => {
        switch (strategy) {
          case LoadingStrategy.Lazy:
            return 'lazy';
          case LoadingStrategy.Eager:
            return 'eager';
          default:
            return 'unknown';
        }
      };

      expect(testStrategy(LoadingStrategy.Lazy)).toBe('lazy');
      expect(testStrategy(LoadingStrategy.Eager)).toBe('eager');
    });

    it('should work in conditional expressions', () => {
      const isLazy = (strategy: LoadingStrategy) => strategy === LoadingStrategy.Lazy;

      expect(isLazy(LoadingStrategy.Lazy)).toBe(true);
    });

    it('should be assignable to variables', () => {
      let strategy: LoadingStrategy;

      strategy = LoadingStrategy.Lazy;
      expect(strategy).toBe(LoadingStrategy.Lazy);

      strategy = LoadingStrategy.Eager;
      expect(strategy).toBe(LoadingStrategy.Eager);
    });
  });
});
