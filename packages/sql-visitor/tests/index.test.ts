import { placeholder } from '../src/index';

describe('sql-visitor package', () => {
  it('should export placeholder value', () => {
    expect(placeholder).toBe('sql-visitor');
  });

  it('should have string type placeholder', () => {
    expect(typeof placeholder).toBe('string');
  });
});
