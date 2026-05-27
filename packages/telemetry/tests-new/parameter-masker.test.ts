import { maskParams } from '../src/parameter-masker';

describe('maskParams', () => {
  it('replaces each param value with a positional placeholder', () => {
    const result = maskParams(['alice', 42, true]);
    expect(result).toEqual([':p0', ':p1', ':p2']);
  });

  it('returns an empty array for empty input', () => {
    expect(maskParams([])).toEqual([]);
  });

  it('handles null values', () => {
    const result = maskParams([null, 'x', null]);
    expect(result).toEqual([':p0', ':p1', ':p2']);
  });

  it('handles a single param', () => {
    expect(maskParams(['secret'])).toEqual([':p0']);
  });

  it('does not mutate the original array', () => {
    const original = ['a', 'b'];
    maskParams(original);
    expect(original).toEqual(['a', 'b']);
  });
});
