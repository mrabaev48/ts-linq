import { maskSql } from '../src/index';

describe('maskSql', () => {
  describe('single-quoted literal redaction', () => {
    it('redacts a single-quoted string literal', () => {
      expect(maskSql("SELECT * FROM users WHERE name = 'alice'")).toBe(
        "SELECT * FROM users WHERE name = '[REDACTED]'"
      );
    });

    it('redacts multiple single-quoted literals', () => {
      expect(maskSql("INSERT INTO t (a, b) VALUES ('x', 'y')")).toBe(
        "INSERT INTO t (a, b) VALUES ('[REDACTED]', '[REDACTED]')"
      );
    });

    it('redacts SQL-style doubled-quote escapes inside a literal', () => {
      // '' is an escaped single quote within a SQL string literal
      expect(maskSql("WHERE note = 'it''s fine'")).toBe("WHERE note = '[REDACTED]'");
    });
  });

  describe('double-quoted literal redaction', () => {
    it('redacts a double-quoted string literal', () => {
      expect(maskSql('SELECT * FROM t WHERE c = "secret"')).toBe(
        'SELECT * FROM t WHERE c = "[REDACTED]"'
      );
    });

    it('redacts double-quoted literals containing backslash-escaped quotes', () => {
      expect(maskSql('WHERE c = "a\\"b"')).toBe('WHERE c = "[REDACTED]"');
    });
  });

  describe('custom patterns', () => {
    it('applies a caller-supplied pattern', () => {
      const masked = maskSql('token=abc123', [/abc123/g]);
      expect(masked).toBe('token=[REDACTED]');
    });

    it('applies custom patterns in addition to the literal regexes', () => {
      const masked = maskSql("name = 'bob' AND id = 42", [/\b\d+\b/g]);
      expect(masked).toBe("name = '[REDACTED]' AND id = [REDACTED]");
    });

    it('is a no-op beyond literal masking when patterns are empty', () => {
      expect(maskSql('SELECT 1', [])).toBe('SELECT 1');
    });

    it('is a no-op beyond literal masking when patterns are undefined', () => {
      expect(maskSql('SELECT 1')).toBe('SELECT 1');
    });
  });

  describe('resilience', () => {
    it('does not throw when a pattern replace fails, and still applies the others', () => {
      // A RegExp whose .replace throws (e.g. a stateful global pattern reused) must be
      // skipped without aborting the loop. We force a throw via a poisoned RegExp.
      const throwing = {
        [Symbol.replace]() {
          throw new Error('boom');
        }
      } as unknown as RegExp;
      const good = /SECRET/g;
      const input = "x = 'lit' SECRET";
      expect(() => maskSql(input, [throwing, good])).not.toThrow();
      // literal masked + the good pattern still applied despite the throwing one
      expect(maskSql(input, [throwing, good])).toBe("x = '[REDACTED]' [REDACTED]");
    });

    it('leaves SQL without literals unchanged', () => {
      expect(maskSql('SELECT id FROM users')).toBe('SELECT id FROM users');
    });
  });

  describe('security', () => {
    it('never leaks a known secret literal in the masked output', () => {
      const secret = 'super-secret-pw';
      const masked = maskSql(`UPDATE creds SET pw = '${secret}' WHERE id = 1`);
      expect(masked).not.toContain(secret);
      expect(masked).toBe("UPDATE creds SET pw = '[REDACTED]' WHERE id = 1");
    });

    it('redacts a secret matched only by a custom pattern', () => {
      const secret = 'AKIA1234567890';
      const masked = maskSql(`-- key ${secret}`, [/AKIA[0-9A-Z]+/g]);
      expect(masked).not.toContain(secret);
    });
  });
});
