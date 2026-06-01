import { toClassName, toContextPropertyName, toPropertyName } from '../name-normalizer';

describe('toClassName', () => {
  const defaults = { useDatabaseNames: false, pluralize: false };

  it('singularizes plain table name', () => {
    expect(toClassName('orders', defaults)).toBe('Order');
  });

  it('handles snake_case', () => {
    expect(toClassName('user_profiles', defaults)).toBe('UserProfile');
  });

  it('preserves database names when useDatabaseNames=true', () => {
    expect(toClassName('UserProfiles', { useDatabaseNames: true, pluralize: false })).toBe(
      'UserProfile'
    );
  });

  it('does not singularize with pluralize=true (useDatabaseNames=true)', () => {
    expect(toClassName('orders', { useDatabaseNames: true, pluralize: true })).toBe('orders');
  });

  it('handles -ies ending', () => {
    expect(toClassName('categories', defaults)).toBe('Category');
  });
});

describe('toPropertyName', () => {
  it('converts snake_case to camelCase by default', () => {
    expect(toPropertyName('user_id', { useDatabaseNames: false, pluralize: false })).toBe('userId');
  });

  it('keeps original name when useDatabaseNames=true', () => {
    expect(toPropertyName('user_id', { useDatabaseNames: true, pluralize: false })).toBe('user_id');
  });
});

describe('toContextPropertyName', () => {
  const defaults = { useDatabaseNames: false, pluralize: false };

  it('returns plural camelCase for DbSet property', () => {
    expect(toContextPropertyName('order', defaults)).toBe('orders');
  });

  it('handles already-plural table name', () => {
    expect(toContextPropertyName('orders', defaults)).toBe('orders');
  });

  it('handles -y ending', () => {
    expect(toContextPropertyName('category', defaults)).toBe('categories');
  });
});
