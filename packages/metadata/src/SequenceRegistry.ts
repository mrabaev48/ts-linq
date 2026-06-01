import type { SequenceMetadata } from '@ts-linq/types';

/** Builds a canonical key for a sequence: "schema.name" or just "name". */
function sequenceKey(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name;
}

/**
 * Registry of model-level database sequences.
 *
 * ModelBuilder._finalize() writes sequences here so that SchemaSnapshotBuilder
 * can read them without receiving a ModelBuilder reference — matching the same
 * singleton pattern as MetadataStorage.
 *
 * ## Test isolation
 * Call `SequenceRegistry.reset()` in `beforeEach` when tests register sequences
 * programmatically to avoid cross-test pollution.
 */
export class SequenceRegistry {
  private static _instance: SequenceRegistry | undefined;

  private readonly _map = new Map<string, SequenceMetadata>();

  /** Process-wide singleton instance. */
  public static getInstance(): SequenceRegistry {
    if (!SequenceRegistry._instance) {
      SequenceRegistry._instance = new SequenceRegistry();
    }
    return SequenceRegistry._instance;
  }

  /** Static helper — register a sequence in the singleton. */
  public static register(meta: SequenceMetadata): void {
    SequenceRegistry.getInstance().register(meta);
  }

  /** Static helper — retrieve all sequences from the singleton. */
  public static getAll(): ReadonlyArray<SequenceMetadata> {
    return SequenceRegistry.getInstance().getAll();
  }

  /** Static helper — reset the singleton (use in tests). */
  public static reset(): void {
    SequenceRegistry._instance = new SequenceRegistry();
  }

  register(meta: SequenceMetadata): void {
    this._map.set(sequenceKey(meta.name, meta.schema), meta);
  }

  get(name: string, schema?: string): SequenceMetadata | undefined {
    return this._map.get(sequenceKey(name, schema));
  }

  getAll(): ReadonlyArray<SequenceMetadata> {
    return Array.from(this._map.values());
  }

  has(name: string, schema?: string): boolean {
    return this._map.has(sequenceKey(name, schema));
  }

  clear(): void {
    this._map.clear();
  }
}
