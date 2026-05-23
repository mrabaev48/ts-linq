import { describe, expect, it } from '@jest/globals';

import { QueryTagError, sanitizeTag } from '../src/ast/query-tags';
import { QueryModel } from '../src/QueryModel';
import { applyTagWith } from '../src/tag-with';
import { captureCallSiteTag } from '../src/tag-with-call-site';

// ─── sanitizeTag ──────────────────────────────────────────────────────────────

describe('sanitizeTag()', () => {
  it('returns the tag unchanged when valid', () => {
    expect(sanitizeTag('dashboard-top-orders')).toBe('dashboard-top-orders');
    expect(sanitizeTag('a b c')).toBe('a b c');
    expect(sanitizeTag('')).toBe('');
  });

  it('throws QueryTagError when tag contains a newline (\\n)', () => {
    expect(() => sanitizeTag('foo\nbar')).toThrow(QueryTagError);
  });

  it('throws QueryTagError when tag contains a carriage return (\\r)', () => {
    expect(() => sanitizeTag('foo\rbar')).toThrow(QueryTagError);
  });

  it('throws QueryTagError when tag contains a comment-break sequence (*/)', () => {
    expect(() => sanitizeTag('foo */ DROP TABLE')).toThrow(QueryTagError);
  });

  it('QueryTagError has the correct name', () => {
    let caught: unknown;
    try {
      sanitizeTag('bad\ntag');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(QueryTagError);
    expect((caught as QueryTagError).name).toBe('QueryTagError');
  });
});

// ─── applyTagWith ─────────────────────────────────────────────────────────────

describe('applyTagWith()', () => {
  it('sets tags on a model with no prior tags', () => {
    const model = new QueryModel();
    applyTagWith('first-tag', model);
    expect(model.tags).toEqual(['first-tag']);
  });

  it('appends tags in call order', () => {
    const model = new QueryModel();
    applyTagWith('tag-a', model);
    applyTagWith('tag-b', model);
    applyTagWith('tag-c', model);
    expect(model.tags).toEqual(['tag-a', 'tag-b', 'tag-c']);
  });

  it('throws QueryTagError for invalid tags and does not mutate the model', () => {
    const model = new QueryModel();
    expect(() => applyTagWith('bad\ntag', model)).toThrow(QueryTagError);
    expect(model.tags).toBeUndefined();
  });
});

// ─── QueryModel.clone() ───────────────────────────────────────────────────────

describe('QueryModel.clone() — tags', () => {
  it('copies tags into the clone', () => {
    const model = new QueryModel();
    applyTagWith('tag-a', model);
    applyTagWith('tag-b', model);
    const cloned = model.clone();
    expect(cloned.tags).toEqual(['tag-a', 'tag-b']);
  });

  it('clone tags are independent from the original', () => {
    const model = new QueryModel();
    applyTagWith('original', model);
    const cloned = model.clone();
    applyTagWith('only-in-clone', cloned);
    expect(model.tags).toEqual(['original']);
    expect(cloned.tags).toEqual(['original', 'only-in-clone']);
  });

  it('clone preserves undefined tags', () => {
    const model = new QueryModel();
    const cloned = model.clone();
    expect(cloned.tags).toBeUndefined();
  });
});

// ─── captureCallSiteTag ───────────────────────────────────────────────────────

describe('captureCallSiteTag()', () => {
  it('returns a string starting with "File:"', () => {
    const tag = captureCallSiteTag();
    expect(tag).toMatch(/^File: /);
  });

  it('includes a line number in the output', () => {
    const tag = captureCallSiteTag();
    // Expected format: "File: /abs/path/file.ts:42"
    expect(tag).toMatch(/:\d+$/);
  });
});
