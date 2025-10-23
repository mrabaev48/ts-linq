import type { ColumnMetadata, IndexMetadata, RelationshipMetadata } from '@ts-linq/types';

/**
 * Temporary storage for decorator metadata before @Entity finalizes registration.
 * 
 * Stage-3 decorators run in this order:
 * 1. Field decorators (@Column, @PrimaryKey) - run first
 * 2. Class decorator (@Entity) - runs last
 * 
 * Field decorators add to this collector, then @Entity reads and finalizes.
 */

interface PendingMetadata {
  columns: Map<string, ColumnMetadata>;
  primaryKeys: Set<string>;
  indexes: IndexMetadata[];
  relationships: Map<string, RelationshipMetadata>;
}

/**
 * WeakMap keyed by class constructor to store pending metadata.
 * Using WeakMap prevents memory leaks when classes are garbage collected.
 */
const pendingMetadata = new WeakMap<Function, PendingMetadata>();

export class PendingMetadataCollector {
  /**
   * Get or create pending metadata for a class
   */
  private static getOrCreate(target: Function): PendingMetadata {
    if (!pendingMetadata.has(target)) {
      pendingMetadata.set(target, {
        columns: new Map(),
        primaryKeys: new Set(),
        indexes: [],
        relationships: new Map()
      });
    }
    return pendingMetadata.get(target)!;
  }

  /**
   * Add column metadata from @Column or @PrimaryKey decorator
   */
  static addColumn(target: Function, propertyName: string, metadata: ColumnMetadata): void {
    const pending = this.getOrCreate(target);
    pending.columns.set(propertyName, metadata);
  }

  /**
   * Mark a column as primary key
   */
  static addPrimaryKey(target: Function, propertyName: string): void {
    const pending = this.getOrCreate(target);
    pending.primaryKeys.add(propertyName);
  }

  /**
   * Add index metadata from @Index decorator
   */
  static addIndex(target: Function, index: IndexMetadata): void {
    const pending = this.getOrCreate(target);
    pending.indexes.push(index);
  }

  /**
   * Add relationship metadata from @ManyToOne, @OneToMany, etc.
   */
  static addRelationship(target: Function, propertyName: string, metadata: RelationshipMetadata): void {
    const pending = this.getOrCreate(target);
    pending.relationships.set(propertyName, metadata);
  }

  /**
   * Retrieve all pending metadata and clear it.
   * Called by @Entity to finalize registration.
   */
  static consumeAndClear(target: Function): PendingMetadata | undefined {
    if (!pendingMetadata.has(target)) {
      return undefined;
    }
    const data = pendingMetadata.get(target)!;
    pendingMetadata.delete(target);
    return data;
  }

  /**
   * Check if there's pending metadata for a class
   */
  static hasPending(target: Function): boolean {
    return pendingMetadata.has(target);
  }
}
