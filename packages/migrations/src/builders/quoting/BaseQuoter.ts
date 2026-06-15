import type { SqlQuoter } from './SqlQuoter';

/**
 * Shared base for the per-dialect quoters.
 *
 * Identifier quoting is expressed as an opening delimiter, a closing delimiter, and a
 * single escape rule (the character that must be doubled inside the identifier so it
 * cannot terminate the quoting early). Literal encoding is shared for every type except
 * booleans, whose rendering is dialect-specific (see {@link formatBoolean}).
 */
export abstract class BaseQuoter implements SqlQuoter {
  /** Opening identifier delimiter (e.g. `"`, `` ` ``, `[`). */
  protected abstract readonly open: string;
  /** Closing identifier delimiter (e.g. `"`, `` ` ``, `]`). */
  protected abstract readonly close: string;
  /** The character that must be escaped inside an identifier. */
  protected abstract readonly escapeChar: string;
  /** The replacement for {@link escapeChar} (the doubled form). */
  protected abstract readonly escapedChar: string;

  /** Renders a boolean literal for the dialect. */
  protected abstract formatBoolean(value: boolean): string;

  public id(identifier: string): string {
    // split/join avoids RegExp special-character pitfalls in the delimiter.
    const escaped = identifier.split(this.escapeChar).join(this.escapedChar);
    return this.open + escaped + this.close;
  }

  public qualified(...parts: string[]): string {
    return parts.map((part) => this.id(part)).join('.');
  }

  public literal(value: unknown): string {
    if (value === null) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return this.formatBoolean(value);
    if (value instanceof Date) return `'${value.toISOString()}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}
