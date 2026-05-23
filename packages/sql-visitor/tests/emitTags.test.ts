import { describe, expect, it } from '@jest/globals';

import { emitTagComments } from '../src/emit-tags';

describe('emitTagComments()', () => {
  it('returns an empty string for an empty tag list', () => {
    expect(emitTagComments([])).toBe('');
  });

  it('emits a single tag as a SQL comment line with trailing newline', () => {
    expect(emitTagComments(['dashboard-top-orders'])).toBe('-- dashboard-top-orders\n');
  });

  it('emits multiple tags in order, separated by newlines, with a trailing newline', () => {
    const result = emitTagComments(['tag-a', 'tag-b', 'tag-c']);
    expect(result).toBe('-- tag-a\n-- tag-b\n-- tag-c\n');
  });

  it('preserves the exact tag content (no trimming or escaping)', () => {
    expect(emitTagComments(['  leading space'])).toBe('--   leading space\n');
    expect(emitTagComments(['tag with spaces'])).toBe('-- tag with spaces\n');
  });

  it('the resulting string, when prepended to SQL, produces valid commented SQL', () => {
    const prefix = emitTagComments(['my-query']);
    const sql = prefix + 'SELECT 1';
    expect(sql).toBe('-- my-query\nSELECT 1');
  });
});
