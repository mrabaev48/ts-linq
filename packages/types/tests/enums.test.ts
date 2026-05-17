import { LoadingStrategy } from '../src/index';

describe('LoadingStrategy Enum', () => {
  it('should have Lazy value', () => {
    expect(LoadingStrategy.Lazy).toBe('lazy');
  });

  it('should have Eager value', () => {
    expect(LoadingStrategy.Eager).toBe('eager');
  });

  it('should have Explicit value', () => {
    expect(LoadingStrategy.Explicit).toBe('explicit');
  });

  it('should have exactly 3 values', () => {
    const values = Object.values(LoadingStrategy);
    expect(values).toHaveLength(3);
    expect(values).toEqual(['lazy', 'eager', 'explicit']);
  });

  it('should allow string comparison', () => {
    const strategy: LoadingStrategy = LoadingStrategy.Lazy;

    expect(strategy === 'lazy').toBe(true);
    expect(strategy === LoadingStrategy.Lazy).toBe(true);
  });

  it('should work in switch statements', () => {
    const testStrategy = (strategy: LoadingStrategy): string => {
      switch (strategy) {
        case LoadingStrategy.Lazy:
          return 'lazy-load';
        case LoadingStrategy.Eager:
          return 'eager-load';
        case LoadingStrategy.Explicit:
          return 'explicit-load';
        default:
          return 'unknown';
      }
    };

    expect(testStrategy(LoadingStrategy.Lazy)).toBe('lazy-load');
    expect(testStrategy(LoadingStrategy.Eager)).toBe('eager-load');
    expect(testStrategy(LoadingStrategy.Explicit)).toBe('explicit-load');
  });
});
