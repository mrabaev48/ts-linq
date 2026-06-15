import { describe, expect, it } from '@jest/globals';

import { JsLiteral } from '../../../src/bundle/codegen/JsLiteral';

describe('JsLiteral', () => {
  describe('string()', () => {
    it('wraps a plain value in double quotes', () => {
      expect(JsLiteral.string('hello')).toBe('"hello"');
    });

    it('escapes embedded double quotes so the literal cannot break out', () => {
      expect(JsLiteral.string('a"b')).toBe('"a\\"b"');
    });

    it('escapes backslashes', () => {
      expect(JsLiteral.string('a\\b')).toBe('"a\\\\b"');
    });

    it('escapes newlines and control characters', () => {
      expect(JsLiteral.string('a\nb')).toBe('"a\\nb"');
    });

    it('produces a literal that round-trips through JSON.parse', () => {
      const value = `weird'"\\\n\t value`;
      expect(JSON.parse(JsLiteral.string(value))).toBe(value);
    });
  });

  describe('modulePath()', () => {
    it('normalizes Windows separators to POSIX', () => {
      expect(JsLiteral.modulePath('C:\\migrations\\0001_Init.mjs')).toBe(
        '"C:/migrations/0001_Init.mjs"'
      );
    });

    it('leaves POSIX paths unchanged (still quoted)', () => {
      expect(JsLiteral.modulePath('/var/app/migrations/0001_Init.mjs')).toBe(
        '"/var/app/migrations/0001_Init.mjs"'
      );
    });

    it('escapes a single quote in the path (no break-out of the import specifier)', () => {
      const encoded = JsLiteral.modulePath("/var/o'brien/0001_Init.mjs");
      expect(encoded).toBe('"/var/o\'brien/0001_Init.mjs"');
      // A single quote does not need JSON escaping but must not appear unescaped inside a
      // single-quoted import — the double-quoted JSON form sidesteps that entirely.
      expect(JSON.parse(encoded)).toBe("/var/o'brien/0001_Init.mjs");
    });

    it('escapes a double quote in the path', () => {
      const encoded = JsLiteral.modulePath('/var/a"b/0001_Init.mjs');
      expect(encoded).toBe('"/var/a\\"b/0001_Init.mjs"');
      expect(JSON.parse(encoded)).toBe('/var/a"b/0001_Init.mjs');
    });

    it('handles paths containing spaces', () => {
      const encoded = JsLiteral.modulePath('/var/My Migrations/0001_Init.mjs');
      expect(encoded).toBe('"/var/My Migrations/0001_Init.mjs"');
      expect(JSON.parse(encoded)).toBe('/var/My Migrations/0001_Init.mjs');
    });

    it('normalizes a Windows path that also contains a quote', () => {
      const encoded = JsLiteral.modulePath('C:\\a"b\\0001_Init.mjs');
      expect(JSON.parse(encoded)).toBe('C:/a"b/0001_Init.mjs');
    });
  });
});
