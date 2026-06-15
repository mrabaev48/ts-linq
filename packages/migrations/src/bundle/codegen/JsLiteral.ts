/**
 * Encoder for JavaScript leaf values embedded in generated bundle source.
 *
 * The bundle generator emits an executable `.mjs` entry point. Any filesystem path or
 * string interpolated into that source is an injection sink: a raw single-quoted path can
 * break out of its quoting (a `'` in the path) or produce invalid escapes (Windows
 * backslashes). This encoder is the single audited place that turns a leaf value into a
 * safe JavaScript string literal — the bundle builder emits structure, leaves go through
 * here (Builder + Encoder separation).
 *
 * `JSON.stringify` is reused deliberately: it produces a double-quoted literal with every
 * quote, backslash, and control character escaped, which is also a valid ECMAScript string
 * literal and a valid ESM import specifier.
 */
export const JsLiteral = {
  /**
   * Encodes an arbitrary string as a safe, double-quoted JavaScript string literal.
   * Quotes, backslashes, and control characters are escaped.
   */
  string(value: string): string {
    return JSON.stringify(value);
  },

  /**
   * Encodes a filesystem path as a safe ESM import specifier.
   *
   * Backslash separators are normalized to POSIX `/` first (so a Windows absolute path is
   * not emitted with invalid `\` escapes), then the result is JSON-encoded so any embedded
   * quote cannot break out of the specifier.
   */
  modulePath(path: string): string {
    return JSON.stringify(path.replace(/\\/g, '/'));
  }
};
