import type { ColumnMetadata, IndexMetadata, RelationshipMetadata } from '@ts-linq/types';

/**
 * Temporary storage for metadata collected by field decorators
 * before @Entity finalizes and registers them in MetadataStorage.
 *
 * Uses WeakMap to avoid memory leaks - entries are garbage collected
 * when the class is no longer referenced.
 */
class PendingMetadataCollectorImpl {
  private columns = new WeakMap<Function, Map<string, ColumnMetadata>>();
  private primaryKeys = new WeakMap<Function, Set<string>>();
  private indexes = new WeakMap<Function, IndexMetadata[]>();
  private relationships = new WeakMap<Function, Map<string, RelationshipMetadata>>();

  addColumn(target: Function, column: ColumnMetadata): void {
    if (!this.columns.has(target)) {
      this.columns.set(target, new Map());
    }
    this.columns.get(target)!.set(column.propertyName, column);
  }

  getColumns(target: Function): Map<string, ColumnMetadata> {
    return this.columns.get(target) || new Map();
  }

  addPrimaryKey(target: Function, propertyName: string): void {
    if (!this.primaryKeys.has(target)) {
      this.primaryKeys.set(target, new Set());
    }
    this.primaryKeys.get(target)!.add(propertyName);
  }

  getPrimaryKeys(target: Function): Set<string> {
    return this.primaryKeys.get(target) || new Set();
  }

  addIndex(target: Function, index: IndexMetadata): void {
    if (!this.indexes.has(target)) {
      this.indexes.set(target, []);
    }
    this.indexes.get(target)!.push(index);
  }

  getIndexes(target: Function): IndexMetadata[] {
    return this.indexes.get(target) || [];
  }

  addRelationship(target: Function, relationship: RelationshipMetadata): void {
    if (!this.relationships.has(target)) {
      this.relationships.set(target, new Map());
    }
    this.relationships.get(target)!.set(relationship.propertyName, relationship);
  }

  getRelationships(target: Function): Map<string, RelationshipMetadata> {
    return this.relationships.get(target) || new Map();
  }

  /**
   * Clear all pending metadata for a target (called by @Entity after registration).
   */
  clear(target: Function): void {
    this.columns.delete(target);
    this.primaryKeys.delete(target);
    this.indexes.delete(target);
    this.relationships.delete(target);
  }
}

/**
 * Global singleton for collecting pending metadata from field decorators.
 */
export const PendingMetadataCollector = new PendingMetadataCollectorImpl();
