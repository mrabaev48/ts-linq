/**
 * Handles serialization and change detection for Json-strategy owned aggregates.
 *
 * Change tracking for JSON columns works by:
 *   1. Serializing the owned aggregate to a JSON string on first read (snapshot).
 *   2. Re-serializing on save and comparing the strings.
 *   3. If different → emit a full-column UPDATE with the new JSON value.
 */
export class JsonSnapshotter {
  /**
   * Serialize an owned aggregate instance to a stable JSON string.
   * Uses sorted keys for deterministic comparison.
   */
  serialize(instance: unknown): string {
    if (instance === null || instance === undefined) return 'null';
    return JSON.stringify(this.sortKeys(instance as Record<string, unknown>));
  }

  /**
   * Returns true if the current aggregate state differs from the original snapshot string.
   */
  hasChanged(originalSnapshot: string, current: unknown): boolean {
    return originalSnapshot !== this.serialize(current);
  }

  /**
   * Produce the value to pass as the UPDATE parameter for the JSON column.
   */
  toUpdateValue(instance: unknown): string {
    return this.serialize(instance);
  }

  private sortKeys(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map((v) => this.sortKeys(v));
    if (typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) {
        sorted[key] = this.sortKeys(record[key]);
      }
      return sorted;
    }
    return obj;
  }
}
