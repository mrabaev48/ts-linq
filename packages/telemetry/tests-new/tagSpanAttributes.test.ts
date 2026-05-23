import { describe, expect, it } from '@jest/globals';

import { parseTagsFromSql } from '../src/tag-span-attributes';

describe('parseTagsFromSql()', () => {
  it('returns undefined for SQL without any leading comments', () => {
    expect(parseTagsFromSql('SELECT 1')).toBeUndefined();
    expect(parseTagsFromSql('  SELECT 1')).toBeUndefined();
    expect(parseTagsFromSql('')).toBeUndefined();
  });

  it('extracts a single tag from a leading -- comment', () => {
    const sql = '-- dashboard-top-orders\nSELECT 1';
    expect(parseTagsFromSql(sql)).toEqual(['dashboard-top-orders']);
  });

  it('extracts multiple tags in order', () => {
    const sql = '-- tag-a\n-- tag-b\n-- tag-c\nSELECT 1';
    expect(parseTagsFromSql(sql)).toEqual(['tag-a', 'tag-b', 'tag-c']);
  });

  it('stops at the first non-comment line', () => {
    const sql = '-- first\nSELECT * FROM t\n-- this is not a tag';
    expect(parseTagsFromSql(sql)).toEqual(['first']);
  });

  it('strips the "-- " prefix, preserving the rest of the tag content', () => {
    const sql = '-- File: controller.ts:42\nSELECT 1';
    expect(parseTagsFromSql(sql)).toEqual(['File: controller.ts:42']);
  });

  it('handles SQL that consists entirely of comment lines (no statement)', () => {
    const sql = '-- only-tags\n-- another';
    expect(parseTagsFromSql(sql)).toEqual(['only-tags', 'another']);
  });

  it('does not mistake lines starting with "#" or "/*" as tags', () => {
    expect(parseTagsFromSql('/* block comment */\nSELECT 1')).toBeUndefined();
    expect(parseTagsFromSql('# hash comment\nSELECT 1')).toBeUndefined();
  });

  it('returns undefined for a line with only "--" (no space)', () => {
    expect(parseTagsFromSql('--no-space\nSELECT 1')).toBeUndefined();
  });
});
