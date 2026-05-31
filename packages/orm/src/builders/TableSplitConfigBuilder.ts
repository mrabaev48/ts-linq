import { extractPropertyName } from './utils';

/**
 * Fluent builder for configuring which properties of an entity are mapped to a
 * secondary table fragment (entity splitting, P1-25).
 *
 * Mirrors EF Core's `SplitToTable` configuration callback:
 * ```ts
 * b.splitToTable("OrdersDetails", s => {
 *   s.property(o => o.notes);
 *   s.property(o => o.internalRef);
 * });
 * ```
 */
export class TableSplitConfigBuilder<T> {
  private readonly _properties: string[] = [];

  property<K extends keyof T>(selector: (e: T) => T[K]): this {
    const name = extractPropertyName(selector);
    if (!this._properties.includes(name)) {
      this._properties.push(name);
    }
    return this;
  }

  /** @internal */
  _build(): string[] {
    return [...this._properties];
  }
}
